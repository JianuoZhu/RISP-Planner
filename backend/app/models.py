from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# Task Models
class TaskStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    deleted = "deleted"


class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    date: str
    status: TaskStatus
    createdAt: str
    updatedAt: str


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    status: Optional[TaskStatus] = None


# RSIP Models
class RSIPNodeStatus(str, Enum):
    draft = "draft"
    active = "active"
    extinguished = "extinguished"


class RSIPNode(BaseModel):
    id: str
    parentId: Optional[str] = None
    title: str
    description: Optional[str] = None
    group: Optional[str] = None
    difficulty: Optional[int] = None
    benefit: Optional[int] = None
    status: RSIPNodeStatus
    createdAt: str
    activatedAt: Optional[str] = None
    extinguishedAt: Optional[str] = None
    totalSuccessCount: int = 0
    totalFailureCount: int = 0
    lastExecutionDate: Optional[str] = None


class RSIPNodeCreate(BaseModel):
    parentId: Optional[str] = None
    title: str
    description: Optional[str] = None
    group: Optional[str] = None
    difficulty: Optional[int] = None
    benefit: Optional[int] = None


class RSIPNodeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    group: Optional[str] = None
    difficulty: Optional[int] = None
    benefit: Optional[int] = None


class RSIPNodeMove(BaseModel):
    newParentId: Optional[str] = Field(None, description="New parent id or null for root")


class RSIPNodeFailure(BaseModel):
    date: Optional[str] = None
    notes: Optional[str] = None


class RSIPEventType(str, Enum):
    activation = "activation"
    failure = "failure"
    rollback = "rollback"


class RSIPEvent(BaseModel):
    id: str
    type: RSIPEventType
    nodeId: str
    affectedNodeIds: Optional[List[str]] = None
    date: str
    createdAt: str
    notes: Optional[str] = None


class RSIPEventFilters(BaseModel):
    nodeId: Optional[str] = None
    type: Optional[RSIPEventType] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None


# Journal Models
class JournalEntry(BaseModel):
    id: str
    date: str
    title: Optional[str] = None
    content: str
    createdAt: str
    updatedAt: str


class JournalUpsert(BaseModel):
    date: str
    title: Optional[str] = None
    content: str


# Summary
class TodaySummary(BaseModel):
    date: str
    pendingTasks: int
    completedTasks: int
    activeNodes: int
    activatedToday: bool
    journalSnippet: Optional[str] = None


# Helpers

def now_iso() -> str:
    return datetime.utcnow().isoformat()


def today_date() -> str:
    return datetime.utcnow().date().isoformat()
