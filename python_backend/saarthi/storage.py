from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS source_cache (
                    source TEXT PRIMARY KEY,
                    fetched_at REAL NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    generated_at TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self.path), timeout=10)

    def cache_source(self, source: str, payload: Any) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO source_cache(source, fetched_at, payload) VALUES(?, ?, ?) "
                "ON CONFLICT(source) DO UPDATE SET fetched_at=excluded.fetched_at, payload=excluded.payload",
                (source, time.time(), json.dumps(payload, ensure_ascii=False)),
            )

    def cached_source(self, source: str, max_age_seconds: Optional[int] = None) -> Optional[dict[str, Any]]:
        with self._connect() as connection:
            row = connection.execute("SELECT fetched_at, payload FROM source_cache WHERE source=?", (source,)).fetchone()
        if not row:
            return None
        age = max(0, int(time.time() - row[0]))
        if max_age_seconds is not None and age > max_age_seconds:
            return None
        return {"payload": json.loads(row[1]), "age_seconds": age}

    def save_run(self, run: dict[str, Any]) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO runs(run_id, generated_at, payload) VALUES(?, ?, ?)",
                (run["run_id"], run["generated_at"], json.dumps(run, ensure_ascii=False)),
            )
