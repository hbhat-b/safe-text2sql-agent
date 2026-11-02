"""SQL guardrail: parse LLM-generated SQL into an AST and allow only safe,
read-only queries against known tables. Never trust the model's output."""

import sqlglot
from sqlglot import exp


class GuardrailError(ValueError):
    """Raised when generated SQL is rejected. The message is fed back to the LLM."""


# Node types that must never appear anywhere in the tree.
_FORBIDDEN_NAMES = [
    "Insert", "Update", "Delete", "Merge", "Drop", "Create", "Alter",
    "AlterTable", "TruncateTable", "Command", "Pragma", "Attach", "Detach",
    "Transaction", "Commit", "Rollback", "Set", "Copy", "LoadData",
]
FORBIDDEN = tuple(t for name in _FORBIDDEN_NAMES if (t := getattr(exp, name, None)))


def validate_sql(sql: str, allowed_tables: list[str], row_limit: int = 100) -> str:
    """Return a safe, normalized SQL string or raise GuardrailError."""
    try:
        statements = [s for s in sqlglot.parse(sql, read="sqlite") if s is not None]
    except sqlglot.errors.ParseError as e:
        raise GuardrailError(f"SQL could not be parsed: {e}") from e

    if len(statements) != 1:
        raise GuardrailError(
            f"Exactly one statement is allowed, got {len(statements)}."
        )
    tree = statements[0]

    if not isinstance(tree, exp.Query):
        raise GuardrailError(
            f"Only SELECT queries are allowed, got {tree.key.upper()}."
        )

    for node in tree.walk():
        if isinstance(node, FORBIDDEN):
            raise GuardrailError(f"Forbidden operation: {node.key.upper()}.")

    # Every referenced table must exist (CTE names are allowed too).
    cte_names = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
    allowed = {t.lower() for t in allowed_tables} | cte_names
    for table in tree.find_all(exp.Table):
        if table.name and table.name.lower() not in allowed:
            raise GuardrailError(f"Unknown or disallowed table: {table.name}.")

    # Cap result size so a bad query can't dump the whole database.
    limit = tree.args.get("limit")
    current = None
    if limit is not None:
        value = limit.args.get("expression")
        if isinstance(value, exp.Literal) and value.is_int:
            current = int(value.this)
    if current is None or current > row_limit:
        tree = tree.limit(row_limit)

    return tree.sql(dialect="sqlite")
