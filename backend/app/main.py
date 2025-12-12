from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    JournalUpsert,
    RSIPEventFilters,
    RSIPNodeCreate,
    RSIPNodeFailure,
    RSIPNodeMove,
    RSIPNodeUpdate,
    TaskCreate,
    TaskUpdate,
)
from .service import PlannerService
from .storage import JSONStorage


DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "storage.json"


def create_app() -> FastAPI:
    storage = JSONStorage(DATA_PATH)
    service = PlannerService(storage)

    app = FastAPI(title="RSIP Planner")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    # Tasks
    @app.post("/tasks")
    def create_task(payload: TaskCreate):
        if not payload.title:
            raise HTTPException(status_code=400, detail="Title is required")
        return service.create_task(payload)

    @app.get("/tasks")
    def list_tasks(date: str):
        return service.list_tasks_for_date(date)

    @app.patch("/tasks/{task_id}")
    def update_task(task_id: str, payload: TaskUpdate):
        updated = service.update_task(task_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Task not found")
        return updated

    @app.post("/tasks/{task_id}/complete")
    def complete_task(task_id: str):
        updated = service.complete_task(task_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Task not found")
        return updated

    @app.delete("/tasks/{task_id}")
    def delete_task(task_id: str):
        if not service.delete_task(task_id):
            raise HTTPException(status_code=404, detail="Task not found")
        return {"status": "deleted"}

    # RSIP Nodes
    @app.get("/rsip/nodes")
    def list_nodes():
        return service.get_nodes()

    @app.post("/rsip/nodes")
    def create_node(payload: RSIPNodeCreate):
        return service.create_node(payload)

    @app.post("/rsip/nodes/{node_id}/activate")
    def activate_node(node_id: str, date: Optional[str] = None):
        updated = service.activate_node(node_id, date)
        if not updated:
            raise HTTPException(status_code=400, detail="Cannot activate node for this date or node missing")
        return updated

    @app.get("/rsip/can-activate")
    def can_activate(date: str):
        return {"canActivate": service.can_activate_on_date(date)}

    @app.patch("/rsip/nodes/{node_id}")
    def update_node(node_id: str, payload: RSIPNodeUpdate):
        updated = service.update_node(node_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Node not found")
        return updated

    @app.post("/rsip/nodes/{node_id}/move")
    def move_node(node_id: str, payload: RSIPNodeMove):
        updated = service.move_node(node_id, payload.newParentId)
        if not updated:
            raise HTTPException(status_code=400, detail="Invalid move")
        return updated

    @app.delete("/rsip/nodes/{node_id}")
    def delete_node(node_id: str):
        if not service.delete_node(node_id):
            raise HTTPException(status_code=404, detail="Node not found")
        return {"status": "deleted"}

    @app.post("/rsip/nodes/{node_id}/fail")
    def fail_node(node_id: str, payload: RSIPNodeFailure):
        return service.fail_node(node_id, payload)

    @app.get("/rsip/events")
    def events(nodeId: Optional[str] = None, type: Optional[str] = None, fromDate: Optional[str] = None, toDate: Optional[str] = None):
        event_type = None
        if type:
            from .models import RSIPEventType

            try:
                event_type = RSIPEventType(type)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid event type")
        filters = RSIPEventFilters(nodeId=nodeId, type=event_type, fromDate=fromDate, toDate=toDate)
        return service.query_events(filters)

    # Journals
    @app.post("/journal")
    def upsert_journal(payload: JournalUpsert):
        return service.upsert_journal(payload)

    @app.get("/journal")
    def get_journal(date: str):
        return service.journal_by_date(date)

    @app.get("/journal/list")
    def list_journal(fromDate: Optional[str] = None, toDate: Optional[str] = None):
        return service.list_journals(fromDate, toDate)

    # Summary
    @app.get("/summary/today")
    def today_summary():
        return service.today_summary()

    return app


app = create_app()
