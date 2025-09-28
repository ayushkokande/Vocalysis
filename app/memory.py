"""Lightweight JSON-backed memory for session history."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from . import constants
from .utils import ensure_storage


class MemoryStore:
    """Append-only memory used to resurface recent coaching sessions."""

    def __init__(self, path: Path | None = None, limit: int | None = None) -> None:
        self.path = path or constants.MEMORY_STORE_PATH
        self.limit = limit or constants.RECENT_SESSION_LIMIT
        ensure_storage()

    def _read(self) -> List[Dict]:
        if not self.path.exists():
            return []
        try:
            return json.loads(self.path.read_text())
        except json.JSONDecodeError:
            return []

    def _write(self, data: List[Dict]) -> None:
        self.path.write_text(json.dumps(data, indent=2))

    def add(self, record: Dict) -> None:
        """Add a memory record, keeping the store within the retention limit."""

        history = self._read()
        history.insert(0, record)
        trimmed = history[: self.limit]
        self._write(trimmed)

    def get_recent(self) -> List[Dict]:
        """Return the most recent coaching memories."""

        return self._read()
