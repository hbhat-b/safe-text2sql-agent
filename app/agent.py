"""LangGraph text-to-SQL agent.

Flow:
    load_schema -> generate_sql -> validate_sql -> execute_sql -> answer
                        ^   |           |              |
                        |   |           +-- retry -----+   (on guardrail or DB error)
                        +---+------------------------------+
                            |
                            +-> decline   (model replied without SQL, e.g. a refusal)
"""

import re
from typing import Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.db import Database
from app.guardrail import GuardrailError, validate_sql


class AgentState(TypedDict, total=False):
    question: str
    schema: str
    sql: str
    error: str | None
    attempts: int
    result: dict[str, Any]
    answer: str
    declined: bool


SQL_SYSTEM_PROMPT = """You are an expert SQLite analyst.
Write ONE read-only SELECT query that answers the user's question.

Rules:
- Use only the tables and columns in the schema below.
- Never modify data. SELECT only.
- Prefer explicit JOINs and readable aliases.
- Return the query in a single ```sql code block and nothing else.
- If the request cannot be answered with a read-only query over this schema
  (for example it asks to change data, or is unrelated to the data), reply with
  one short, polite sentence explaining why, and no code block.

Schema:
{schema}"""

ANSWER_SYSTEM_PROMPT = """You answer questions using SQL query results.
Be concise and specific. If the result is empty, say so plainly.
Do not invent data that is not in the result."""

_SQL_BLOCK = re.compile(r"```(?:sql)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_SQL_START = re.compile(
    r"^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH)\b",
    re.IGNORECASE,
)
_WRITE_INTENT = re.compile(
    r"\b(delete|drop|remove|update|insert|add|create|alter|truncate|modify|change|rename)\b",
    re.IGNORECASE,
)

# Guardrail errors that mean the model kept writing a data-changing statement.
_WRITE_REJECTED = re.compile(r"Only SELECT queries are allowed|Forbidden operation")

READ_ONLY_REPLY = (
    "I can only read the music store data, not change it, so I can't do that. "
    "Try asking a question about it instead, like \"How many customers are there?\""
)
DECLINED_REPLY = (
    "I can only answer questions about the Chinook music store data, such as artists, "
    "albums, tracks, customers, invoices and employees. Try rephrasing your question."
)
GIVE_UP_REPLY = (
    "I couldn't build a reliable query for that question. Try rephrasing it or "
    "making it more specific, for example by naming the table or time period you mean."
)


def clean_text(text: str) -> str:
    """Strip terminal escape codes some models emit."""
    return _ANSI.sub("", text).strip()


def extract_sql(text: str) -> str:
    match = _SQL_BLOCK.search(text)
    return (match.group(1) if match else text).strip().rstrip(";").strip()


def looks_like_sql(text: str) -> bool:
    """True if the reply contains a query; False for prose such as a refusal."""
    return bool(_SQL_BLOCK.search(text) or _SQL_START.match(text))


def decline_reply(question: str) -> str:
    return READ_ONLY_REPLY if _WRITE_INTENT.search(question) else DECLINED_REPLY


def build_graph(llm: BaseChatModel, db: Database, max_retries: int = 2, row_limit: int = 100):
    tables = db.table_names()

    def load_schema(state: AgentState) -> AgentState:
        return {"schema": db.schema(), "attempts": 0, "error": None}

    def generate_sql(state: AgentState) -> AgentState:
        messages = [
            SystemMessage(SQL_SYSTEM_PROMPT.format(schema=state["schema"])),
            HumanMessage(state["question"]),
        ]
        if state.get("error"):
            messages.append(
                HumanMessage(
                    f"Your previous query failed.\nQuery: {state.get('sql')}\n"
                    f"Error: {state['error']}\nFix it and return a corrected query."
                )
            )
        text = clean_text(llm.invoke(messages).content)
        if not looks_like_sql(text):
            # A refusal or explanation: retrying would only produce more of the same.
            return {"sql": "", "declined": True, "attempts": state["attempts"] + 1}
        return {"sql": extract_sql(text), "declined": False, "attempts": state["attempts"] + 1}

    def validate(state: AgentState) -> AgentState:
        try:
            return {"sql": validate_sql(state["sql"], tables, row_limit), "error": None}
        except GuardrailError as e:
            return {"error": f"Guardrail rejected query: {e}"}

    def execute(state: AgentState) -> AgentState:
        try:
            return {"result": db.run(state["sql"]), "error": None}
        except Exception as e:  # sqlite errors go back to the LLM for a retry
            return {"error": f"Database error: {e}"}

    def answer(state: AgentState) -> AgentState:
        result = state["result"]
        preview = {"columns": result["columns"], "rows": result["rows"][:50]}
        response = llm.invoke(
            [
                SystemMessage(ANSWER_SYSTEM_PROMPT),
                HumanMessage(
                    f"Question: {state['question']}\nSQL: {state['sql']}\nResult: {preview}"
                ),
            ]
        )
        return {"answer": clean_text(response.content)}

    def decline(state: AgentState) -> AgentState:
        return {"answer": decline_reply(state["question"])}

    def give_up(state: AgentState) -> AgentState:
        # The technical error stays in state["error"] (and in the streamed steps) for debugging.
        wanted_write = _WRITE_INTENT.search(state["question"])
        if wanted_write and _WRITE_REJECTED.search(state.get("error") or ""):
            return {"answer": READ_ONLY_REPLY}
        return {"answer": GIVE_UP_REPLY}

    def route_after_generate(state: AgentState) -> str:
        return "decline" if state.get("declined") else "validate"

    def route_after_check(state: AgentState) -> str:
        if not state.get("error"):
            return "ok"
        return "retry" if state["attempts"] <= max_retries else "give_up"

    graph = StateGraph(AgentState)
    graph.add_node("load_schema", load_schema)
    graph.add_node("generate_sql", generate_sql)
    graph.add_node("validate_sql", validate)
    graph.add_node("execute_sql", execute)
    graph.add_node("answer", answer)
    graph.add_node("decline", decline)
    graph.add_node("give_up", give_up)

    graph.add_edge(START, "load_schema")
    graph.add_edge("load_schema", "generate_sql")
    graph.add_conditional_edges(
        "generate_sql",
        route_after_generate,
        {"validate": "validate_sql", "decline": "decline"},
    )
    graph.add_conditional_edges(
        "validate_sql",
        route_after_check,
        {"ok": "execute_sql", "retry": "generate_sql", "give_up": "give_up"},
    )
    graph.add_conditional_edges(
        "execute_sql",
        route_after_check,
        {"ok": "answer", "retry": "generate_sql", "give_up": "give_up"},
    )
    graph.add_edge("answer", END)
    graph.add_edge("decline", END)
    graph.add_edge("give_up", END)
    return graph.compile()
