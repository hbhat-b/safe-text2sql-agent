"""FastAPI app: REST endpoint for one-shot queries, WebSocket for streamed agent steps."""

from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.agent import build_graph
from app.config import get_settings
from app.db import Database

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Safe Text-to-SQL Agent", version="0.1.0")


class QueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class QueryResponse(BaseModel):
    question: str
    sql: str | None
    answer: str
    columns: list[str] = []
    rows: list[list] = []
    attempts: int


@lru_cache
def get_agent():
    s = get_settings()
    llm = ChatOpenAI(
        model=s.llm_model,
        api_key=s.llm_api_key,
        base_url=s.llm_base_url,
        temperature=s.llm_temperature,
    )
    return build_graph(llm, Database(s.db_path), s.max_retries, s.row_limit)


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    state = await get_agent().ainvoke({"question": req.question})
    result = state.get("result") or {}
    return QueryResponse(
        question=req.question,
        sql=state.get("sql"),
        answer=state["answer"],
        columns=result.get("columns", []),
        rows=result.get("rows", []),
        attempts=state.get("attempts", 0),
    )


@app.websocket("/ws/query")
async def ws_query(ws: WebSocket):
    """Client sends {"question": "..."}; server streams one event per graph step."""
    await ws.accept()
    try:
        while True:
            payload = await ws.receive_json()
            question = str(payload.get("question", "")).strip()
            if not question:
                await ws.send_json({"type": "error", "message": "question is required"})
                continue
            async for update in get_agent().astream(
                {"question": question}, stream_mode="updates"
            ):
                for node, data in update.items():
                    data = dict(data or {})
                    data.pop("schema", None)  # too large to stream every time
                    await ws.send_json({"type": "step", "node": node, "data": data})
            await ws.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass
