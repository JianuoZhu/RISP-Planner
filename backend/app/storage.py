import json
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from .models import (
    JournalEntry,
    RSIPEvent,
    RSIPNode,
    Task,
)


class JSONStorage:
    def __init__(self, path: Path):
        self.path = path
        self.lock = Lock()
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(
                json.dumps(
                    {
                        "tasks": [],
                        "rsipNodes": [],
                        "rsipEvents": [],
                        "journals": [],
                    },
                    indent=2,
                )
            )

    def read(self) -> Dict[str, Any]:
        with self.lock:
            return json.loads(self.path.read_text())

    def write(
        self,
        *,
        tasks: Optional[List[Task]] = None,
        rsip_nodes: Optional[List[RSIPNode]] = None,
        rsip_events: Optional[List[RSIPEvent]] = None,
        journals: Optional[List[JournalEntry]] = None,
    ) -> None:
        with self.lock:
            data = json.loads(self.path.read_text())
            if tasks is not None:
                data["tasks"] = [t.model_dump() for t in tasks]
            if rsip_nodes is not None:
                data["rsipNodes"] = [n.model_dump() for n in rsip_nodes]
            if rsip_events is not None:
                data["rsipEvents"] = [e.model_dump() for e in rsip_events]
            if journals is not None:
                data["journals"] = [j.model_dump() for j in journals]
            self.path.write_text(json.dumps(data, indent=2))

    def load_tasks(self) -> List[Task]:
        data = self.read()
        return [Task(**item) for item in data.get("tasks", [])]

    def load_nodes(self) -> List[RSIPNode]:
        data = self.read()
        return [RSIPNode(**item) for item in data.get("rsipNodes", [])]

    def load_events(self) -> List[RSIPEvent]:
        data = self.read()
        return [RSIPEvent(**item) for item in data.get("rsipEvents", [])]

    def load_journals(self) -> List[JournalEntry]:
        data = self.read()
        return [JournalEntry(**item) for item in data.get("journals", [])]
