"""Database access. The connection itself is read-only (SQLite `mode=ro`),
so even if the guardrail were bypassed, writes would still fail."""

import sqlite3
from pathlib import Path
from typing import Any


class Database:
    def __init__(self, path: str):
        if not Path(path).exists():
            raise FileNotFoundError(
                f"Database not found at {path}. Run: python scripts/download_db.py"
            )
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(f"file:{self.path}?mode=ro", uri=True)

    def table_names(self) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
        return [r[0] for r in rows]

    def schema(self) -> str:
        """Compact schema description for the LLM prompt: columns, types, foreign keys."""
        lines: list[str] = []
        with self._connect() as conn:
            for table in self.table_names():
                cols = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
                col_desc = ", ".join(
                    f"{c[1]} {c[2]}{' PK' if c[5] else ''}" for c in cols
                )
                fks = conn.execute(f'PRAGMA foreign_key_list("{table}")').fetchall()
                fk_desc = "; ".join(f"{fk[3]} -> {fk[2]}.{fk[4]}" for fk in fks)
                lines.append(
                    f"{table}({col_desc})" + (f"  FK: {fk_desc}" if fk_desc else "")
                )
        return "\n".join(lines)

    def run(self, sql: str) -> dict[str, Any]:
        with self._connect() as conn:
            cur = conn.execute(sql)
            columns = [d[0] for d in cur.description] if cur.description else []
            rows = [list(r) for r in cur.fetchall()]
        return {"columns": columns, "rows": rows}
