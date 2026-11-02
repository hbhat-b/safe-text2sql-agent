from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.agent import (
    DECLINED_REPLY,
    GIVE_UP_REPLY,
    READ_ONLY_REPLY,
    build_graph,
    clean_text,
    extract_sql,
    looks_like_sql,
)


def test_extract_sql_from_code_block():
    assert extract_sql("Here:\n```sql\nSELECT 1;\n```") == "SELECT 1"
    assert extract_sql("SELECT 2") == "SELECT 2"


def test_happy_path(db):
    llm = FakeListChatModel(
        responses=[
            "```sql\nSELECT Name FROM Artist ORDER BY Name\n```",
            "There are 3 artists: AC/DC, Aerosmith and Audioslave.",
        ]
    )
    state = build_graph(llm, db).invoke({"question": "List all artists"})

    assert state["attempts"] == 1
    assert state["result"]["rows"] == [["AC/DC"], ["Aerosmith"], ["Audioslave"]]
    assert "3 artists" in state["answer"]


def test_retries_after_guardrail_rejection(db):
    llm = FakeListChatModel(
        responses=[
            "```sql\nDELETE FROM Artist\n```",  # rejected by guardrail
            "```sql\nSELECT COUNT(*) FROM Artist\n```",  # corrected
            "There are 3 artists.",
        ]
    )
    state = build_graph(llm, db).invoke({"question": "How many artists?"})

    assert state["attempts"] == 2
    assert state["result"]["rows"] == [[3]]


def test_retries_after_database_error(db):
    llm = FakeListChatModel(
        responses=[
            "```sql\nSELECT Nmae FROM Artist\n```",  # typo -> sqlite error
            "```sql\nSELECT Name FROM Artist\n```",
            "Three artists.",
        ]
    )
    state = build_graph(llm, db).invoke({"question": "List artists"})

    assert state["attempts"] == 2
    assert len(state["result"]["rows"]) == 3


def test_gives_up_after_max_retries(db):
    llm = FakeListChatModel(responses=["```sql\nDROP TABLE Artist\n```"] * 5)
    state = build_graph(llm, db, max_retries=2).invoke({"question": "Drop everything"})

    assert state["attempts"] == 3
    assert state["answer"] == READ_ONLY_REPLY  # plain explanation, no parser errors
    assert db.table_names() == ["Album", "Artist"]  # nothing was dropped


def test_give_up_hides_technical_errors(db):
    llm = FakeListChatModel(responses=["```sql\nSELECT Nope FROM Artist\n```"] * 5)
    state = build_graph(llm, db, max_retries=1).invoke({"question": "List artists"})

    assert state["answer"] == GIVE_UP_REPLY
    assert "Database error" in state["error"]  # still available for debugging


def test_refusal_declines_without_retrying(db):
    llm = FakeListChatModel(responses=["I'm sorry\x1b[4m,\x1b[0m but I can't help with that."])
    state = build_graph(llm, db).invoke({"question": "Delete all customers"})

    assert state["attempts"] == 1
    assert state["declined"] is True
    assert state["answer"] == READ_ONLY_REPLY
    assert "result" not in state


def test_off_topic_refusal_gets_general_reply(db):
    llm = FakeListChatModel(responses=["That question isn't about this database."])
    state = build_graph(llm, db).invoke({"question": "What's the weather today?"})

    assert state["answer"] == DECLINED_REPLY


def test_clean_text_and_sql_detection():
    assert clean_text("sorry\x1b[4m,\x1b[0m no") == "sorry, no"
    assert looks_like_sql("```sql\nSELECT 1\n```")
    assert looks_like_sql("select 1")
    assert not looks_like_sql("I'm sorry, but I can't help with that.")
