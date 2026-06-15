"""Two-tier cache: in-memory dict in front of a SQLite table.

Live data is cached for 5 minutes, slow-moving data (standings, players)
for 30 minutes. When the upstream API quota is exhausted the most recent
cached value keeps being served, so the dashboard never goes blank.
"""

import json
import os
import sqlite3
import threading
import time
from typing import Any, Optional

LIVE_TTL = 1 * 60
SLOW_TTL = 30 * 60

_DB_PATH = os.environ.get("CACHE_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "matchiq_cache.db"))


class Cache:
    def __init__(self, db_path: str = _DB_PATH):
        self._mem: dict = {}
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires REAL NOT NULL)"
        )
        self._conn.commit()

    def get(self, key: str, allow_stale: bool = False) -> Optional[Any]:
        now = time.time()
        with self._lock:
            entry = self._mem.get(key)
            if entry and (allow_stale or entry[1] > now):
                return entry[0]
            row = self._conn.execute("SELECT value, expires FROM cache WHERE key = ?", (key,)).fetchone()
        if row and (allow_stale or row[1] > now):
            value = json.loads(row[0])
            with self._lock:
                self._mem[key] = (value, row[1])
            return value
        return None

    def set(self, key: str, value: Any, ttl: int) -> None:
        expires = time.time() + ttl
        payload = json.dumps(value)
        with self._lock:
            self._mem[key] = (value, expires)
            self._conn.execute(
                "INSERT INTO cache (key, value, expires) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires",
                (key, payload, expires),
            )
            self._conn.commit()


cache = Cache()
