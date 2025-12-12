from __future__ import annotations

import uuid
from typing import List, Optional

from .models import (
    JournalEntry,
    JournalUpsert,
    RSIPEvent,
    RSIPEventFilters,
    RSIPEventType,
    RSIPNode,
    RSIPNodeCreate,
    RSIPNodeFailure,
    RSIPNodeStatus,
    RSIPNodeUpdate,
    Task,
    TaskCreate,
    TaskStatus,
    TaskUpdate,
    TodaySummary,
    now_iso,
    today_date,
)
from .storage import JSONStorage


class PlannerService:
    def __init__(self, storage: JSONStorage):
        self.storage = storage

    # Task operations
    def list_tasks_for_date(self, date: str) -> List[Task]:
        tasks = [t for t in self.storage.load_tasks() if t.date == date and t.status != TaskStatus.deleted]
        tasks.sort(key=lambda t: (t.status != TaskStatus.pending, t.createdAt))
        return tasks

    def create_task(self, data: TaskCreate) -> Task:
        now = now_iso()
        task = Task(
            id=str(uuid.uuid4()),
            title=data.title,
            description=data.description,
            date=data.date or today_date(),
            status=TaskStatus.pending,
            createdAt=now,
            updatedAt=now,
        )
        tasks = self.storage.load_tasks()
        tasks.append(task)
        self.storage.write(tasks=tasks)
        return task

    def update_task(self, task_id: str, updates: TaskUpdate) -> Optional[Task]:
        tasks = self.storage.load_tasks()
        for index, task in enumerate(tasks):
            if task.id == task_id:
                updated = task.model_copy(update={**updates.model_dump(exclude_unset=True), "updatedAt": now_iso()})
                tasks[index] = updated
                self.storage.write(tasks=tasks)
                return updated
        return None

    def delete_task(self, task_id: str) -> bool:
        return self.update_task(task_id, TaskUpdate(status=TaskStatus.deleted)) is not None

    def complete_task(self, task_id: str) -> Optional[Task]:
        return self.update_task(task_id, TaskUpdate(status=TaskStatus.completed))

    # RSIP node operations
    def get_nodes(self) -> List[RSIPNode]:
        return self.storage.load_nodes()

    def create_node(self, data: RSIPNodeCreate) -> RSIPNode:
        now = now_iso()
        node = RSIPNode(
            id=str(uuid.uuid4()),
            parentId=data.parentId,
            title=data.title,
            description=data.description,
            group=data.group,
            difficulty=data.difficulty,
            benefit=data.benefit,
            status=RSIPNodeStatus.draft,
            createdAt=now,
            totalSuccessCount=0,
            totalFailureCount=0,
        )
        nodes = self.storage.load_nodes()
        nodes.append(node)
        self.storage.write(rsip_nodes=nodes)
        return node

    def _activated_count_for_date(self, date: str) -> int:
        return len([n for n in self.storage.load_nodes() if n.activatedAt == date])

    def can_activate_on_date(self, date: str) -> bool:
        return self._activated_count_for_date(date) == 0

    def activate_node(self, node_id: str, activation_date: Optional[str] = None) -> Optional[RSIPNode]:
        target_date = activation_date or today_date()
        nodes = self.storage.load_nodes()
        if not self.can_activate_on_date(target_date):
            return None

        for idx, node in enumerate(nodes):
            if node.id == node_id:
                now = now_iso()
                updated = node.copy(
                    update={
                        "status": RSIPNodeStatus.active,
                        "activatedAt": target_date,
                    }
                )
                nodes[idx] = updated
                events = self.storage.load_events()
                events.append(
                    RSIPEvent(
                        id=str(uuid.uuid4()),
                        type=RSIPEventType.activation,
                        nodeId=node_id,
                        date=target_date,
                        createdAt=now,
                    )
                )
                self.storage.write(rsip_nodes=nodes, rsip_events=events)
                return updated
        return None

    def update_node(self, node_id: str, updates: RSIPNodeUpdate) -> Optional[RSIPNode]:
        nodes = self.storage.load_nodes()
        for idx, node in enumerate(nodes):
            if node.id == node_id:
                nodes[idx] = node.model_copy(update=updates.model_dump(exclude_unset=True))
                self.storage.write(rsip_nodes=nodes)
                return nodes[idx]
        return None

    def move_node(self, node_id: str, new_parent_id: Optional[str]) -> Optional[RSIPNode]:
        nodes = self.storage.load_nodes()
        node_map = {n.id: n for n in nodes}

        if new_parent_id == node_id:
            return None

        # detect cycle
        ancestor = new_parent_id
        while ancestor:
            if ancestor == node_id:
                return None
            ancestor = node_map.get(ancestor).parentId if ancestor in node_map else None

        for idx, node in enumerate(nodes):
            if node.id == node_id:
                nodes[idx] = node.model_copy(update={"parentId": new_parent_id})
                self.storage.write(rsip_nodes=nodes)
                return nodes[idx]
        return None

    def _collect_subtree(self, nodes: List[RSIPNode], root_id: str) -> List[RSIPNode]:
        child_map = {}
        for node in nodes:
            child_map.setdefault(node.parentId, []).append(node)

        result = []
        stack = [root_id]
        while stack:
            current = stack.pop()
            result.append(current)
            for child in child_map.get(current, []):
                stack.append(child.id)
        return [n for n in nodes if n.id in result]

    def fail_node(self, node_id: str, payload: RSIPNodeFailure) -> List[RSIPNode]:
        nodes = self.storage.load_nodes()
        subtree_nodes = self._collect_subtree(nodes, node_id)
        now = now_iso()
        date = payload.date or today_date()

        id_set = {n.id for n in subtree_nodes}
        updated_nodes = []
        for node in nodes:
            if node.id in id_set and node.status == RSIPNodeStatus.active:
                updated_nodes.append(node.model_copy(update={"status": RSIPNodeStatus.extinguished, "extinguishedAt": date}))
            else:
                updated_nodes.append(node)

        events = self.storage.load_events()
        events.append(
            RSIPEvent(
                id=str(uuid.uuid4()),
                type=RSIPEventType.failure,
                nodeId=node_id,
                date=date,
                createdAt=now,
                notes=payload.notes,
            )
        )
        events.append(
            RSIPEvent(
                id=str(uuid.uuid4()),
                type=RSIPEventType.rollback,
                nodeId=node_id,
                affectedNodeIds=list(id_set),
                date=date,
                createdAt=now,
            )
        )

        self.storage.write(rsip_nodes=updated_nodes, rsip_events=events)
        return [n for n in updated_nodes if n.id in id_set]

    # Events
    def query_events(self, filters: RSIPEventFilters) -> List[RSIPEvent]:
        events = self.storage.load_events()
        result = []
        for event in events:
            if filters.nodeId and event.nodeId != filters.nodeId:
                continue
            if filters.type and event.type != filters.type:
                continue
            if filters.fromDate and event.date < filters.fromDate:
                continue
            if filters.toDate and event.date > filters.toDate:
                continue
            result.append(event)
        result.sort(key=lambda e: e.createdAt, reverse=True)
        return result

    # Journals
    def upsert_journal(self, payload: JournalUpsert) -> JournalEntry:
        journals = self.storage.load_journals()
        existing = next((j for j in journals if j.date == payload.date), None)
        now = now_iso()
        if existing:
            updated = existing.model_copy(update={"title": payload.title, "content": payload.content, "updatedAt": now})
            journals = [updated if j.id == existing.id else j for j in journals]
            self.storage.write(journals=journals)
            return updated

        entry = JournalEntry(
            id=str(uuid.uuid4()),
            date=payload.date,
            title=payload.title,
            content=payload.content,
            createdAt=now,
            updatedAt=now,
        )
        journals.append(entry)
        self.storage.write(journals=journals)
        return entry

    def journal_by_date(self, date: str) -> Optional[JournalEntry]:
        return next((j for j in self.storage.load_journals() if j.date == date), None)

    def list_journals(self, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[JournalEntry]:
        journals = self.storage.load_journals()
        result = []
        for entry in journals:
            if from_date and entry.date < from_date:
                continue
            if to_date and entry.date > to_date:
                continue
            result.append(entry)
        result.sort(key=lambda j: j.date, reverse=True)
        return result

    # Summary
    def today_summary(self) -> TodaySummary:
        date = today_date()
        tasks = self.list_tasks_for_date(date)
        nodes = self.get_nodes()
        activated_today = any(n.activatedAt == date for n in nodes)
        journal = self.journal_by_date(date)
        return TodaySummary(
            date=date,
            pendingTasks=len([t for t in tasks if t.status == TaskStatus.pending]),
            completedTasks=len([t for t in tasks if t.status == TaskStatus.completed]),
            activeNodes=len([n for n in nodes if n.status == RSIPNodeStatus.active]),
            activatedToday=activated_today,
            journalSnippet=(journal.content[:120] + "..." if journal and len(journal.content) > 120 else (journal.content if journal else None)),
        )
