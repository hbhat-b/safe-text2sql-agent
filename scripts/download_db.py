"""Download the public Chinook sample database (a digital music store)."""

import sys
import urllib.request
from pathlib import Path

URL = (
    "https://github.com/lerocha/chinook-database/releases/download/"
    "v1.4.5/Chinook_Sqlite.sqlite"
)
DEST = Path(__file__).resolve().parent.parent / "data" / "chinook.sqlite"


def main() -> None:
    if DEST.exists():
        print(f"Already present: {DEST}")
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Chinook database to {DEST} ...")
    try:
        urllib.request.urlretrieve(URL, DEST)
    except Exception as e:
        sys.exit(f"Download failed: {e}")
    print("Done.")


if __name__ == "__main__":
    main()
