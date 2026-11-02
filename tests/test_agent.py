from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.agent import build_graph, extract_sql


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
    assert "couldn't produce a valid query" in state["answer"]
    assert db.table_names() == ["Album", "Artist"]  # nothing was dropped
