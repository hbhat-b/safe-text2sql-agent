import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app import main
from app.agent import build_graph


@pytest.fixture
def client(db, monkeypatch):
    llm = FakeListChatModel(
        responses=["```sql\nSELECT COUNT(*) AS n FROM Album\n```", "There are 3 albums."]
    )
    monkeypatch.setattr(main, "get_agent", lambda: build_graph(llm, db))
    return TestClient(main.app)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_query_endpoint(client):
    res = client.post("/query", json={"question": "How many albums?"})
    body = res.json()

    assert res.status_code == 200
    assert body["sql"].startswith("SELECT COUNT(*)")
    assert body["rows"] == [[3]]
    assert body["answer"] == "There are 3 albums."


def test_query_validation(client):
    assert client.post("/query", json={"question": ""}).status_code == 422


def test_websocket_streams_steps(client):
    with client.websocket_connect("/ws/query") as ws:
        ws.send_json({"question": "How many albums?"})
        nodes = []
        while (msg := ws.receive_json())["type"] != "done":
            nodes.append(msg["node"])

    assert nodes == ["load_schema", "generate_sql", "validate_sql", "execute_sql", "answer"]
