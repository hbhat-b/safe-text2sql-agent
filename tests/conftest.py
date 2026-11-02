import sqlite3

import pytest

from app.db import Database


@pytest.fixture
def db(tmp_path) -> Database:
    """Tiny in-test database so tests don't depend on downloading Chinook."""
    path = tmp_path / "test.sqlite"
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE Artist (ArtistId INTEGER PRIMARY KEY, Name TEXT);
        CREATE TABLE Album (
            AlbumId INTEGER PRIMARY KEY, Title TEXT,
            ArtistId INTEGER REFERENCES Artist(ArtistId)
        );
        INSERT INTO Artist VALUES (1, 'AC/DC'), (2, 'Aerosmith'), (3, 'Audioslave');
        INSERT INTO Album VALUES (1, 'Back in Black', 1), (2, 'Highway to Hell', 1),
                                 (3, 'Pump', 2);
        """
    )
    conn.commit()
    conn.close()
    return Database(str(path))
