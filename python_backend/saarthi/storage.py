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
                CREATE TABLE IF NOT EXISTS sync_outbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL UNIQUE,
                    created_at REAL NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
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

    def queue_sync(self, run: dict[str, Any], error: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO sync_outbox(run_id, created_at, attempts, last_error, payload) VALUES(?, ?, 1, ?, ?) "
                "ON CONFLICT(run_id) DO UPDATE SET attempts=sync_outbox.attempts+1, last_error=excluded.last_error, payload=excluded.payload",
                (run["run_id"], time.time(), error[:500], json.dumps(run, ensure_ascii=False)),
            )

    def pending_sync(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT id, payload FROM sync_outbox ORDER BY id LIMIT ?", (limit,)).fetchall()
        return [{"id": row[0], "payload": json.loads(row[1])} for row in rows]

    def pending_sync_count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) FROM sync_outbox").fetchone()
        return int(row[0])

    def mark_sync_complete(self, item_id: int) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM sync_outbox WHERE id=?", (item_id,))

    def mark_sync_failed(self, item_id: int, error: str) -> None:
        with self._connect() as connection:
            connection.execute("UPDATE sync_outbox SET attempts=attempts+1, last_error=? WHERE id=?", (error[:500], item_id))
