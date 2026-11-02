"""LangGraph text-to-SQL agent.

Flow:
    load_schema -> generate_sql -> validate_sql -> execute_sql -> answer
                        ^               |              |
                        +---- retry ----+--------------+   (on guardrail or DB error)
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


SQL_SYSTEM_PROMPT = """You are an expert SQLite analyst.
Write ONE read-only SELECT query that answers the user's question.

Rules:
- Use only the tables and columns in the schema below.
- Never modify data. SELECT only.
- Prefer explicit JOINs and readable aliases.
- Return the query in a single ```sql code block and nothing else.

Schema:
{schema}"""

ANSWER_SYSTEM_PROMPT = """You answer questions using SQL query results.
Be concise and specific. If the result is empty, say so plainly.
Do not invent data that is not in the result."""

_SQL_BLOCK = re.compile(r"```(?:sql)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_sql(text: str) -> str:
    match = _SQL_BLOCK.search(text)
    return (match.group(1) if match else text).strip().rstrip(";").strip()


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
        response = llm.invoke(messages)
        return {"sql": extract_sql(response.content), "attempts": state["attempts"] + 1}

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
        return {"answer": response.content.strip()}

    def give_up(state: AgentState) -> AgentState:
        return {
            "answer": f"Sorry, I couldn't produce a valid query after "
            f"{state['attempts']} attempts. Last error: {state['error']}"
        }

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
    graph.add_node("give_up", give_up)

    graph.add_edge(START, "load_schema")
    graph.add_edge("load_schema", "generate_sql")
    graph.add_edge("generate_sql", "validate_sql")
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
    graph.add_edge("give_up", END)
    return graph.compile()
