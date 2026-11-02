import pytest

from app.guardrail import GuardrailError, validate_sql

TABLES = ["Artist", "Album"]


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM Artist",
        "select name from artist",
        "SELECT a.Name, COUNT(*) FROM Artist a "
        "JOIN Album b ON a.ArtistId = b.ArtistId GROUP BY a.Name",
        "WITH x AS (SELECT * FROM Artist) SELECT * FROM x",
        "SELECT Name FROM Artist UNION SELECT Title FROM Album",
    ],
)
def test_allows_read_only_queries(sql):
    assert validate_sql(sql, TABLES).upper().startswith(("SELECT", "WITH"))


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE Artist",
        "DELETE FROM Artist",
        "UPDATE Artist SET Name = 'x'",
        "INSERT INTO Artist VALUES (9, 'x')",
        "PRAGMA table_info(Artist)",
        "ATTACH DATABASE 'other.db' AS other",
        "SELECT 1; DROP TABLE Artist",
        "SELECT * FROM users",
        "this is not sql at all ((",
    ],
)
def test_rejects_unsafe_queries(sql):
    with pytest.raises(GuardrailError):
        validate_sql(sql, TABLES)


def test_adds_limit_when_missing():
    assert validate_sql("SELECT * FROM Artist", TABLES, row_limit=50).endswith("LIMIT 50")


def test_caps_large_limit():
    sql = validate_sql("SELECT * FROM Artist LIMIT 10000", TABLES, row_limit=50)
    assert sql.endswith("LIMIT 50")


def test_keeps_small_limit():
    assert validate_sql("SELECT * FROM Artist LIMIT 5", TABLES, row_limit=50).endswith("LIMIT 5")
