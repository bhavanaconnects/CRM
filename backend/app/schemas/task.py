"""Ported from src/validators/task.ts, extended for the Tasks module.

`description` is now a real, persisted column (see
db/migrations/20260918000000_tasks_description_completed_at.sql), so unlike
the original Next.js app it is no longer silently dropped.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

TaskStatus = Literal["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
TaskPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]

TASK_STATUSES = ("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED")
TASK_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "URGENT")


class TaskBase(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    assigneeId: Optional[str] = None
    leadId: Optional[str] = None
    contactId: Optional[str] = None
    companyId: Optional[str] = None
    dealId: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    dueDate: Optional[str] = None


class TaskCreate(TaskBase):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned


# updateTaskSchema = createTaskSchema.partial() in the source.
class TaskUpdate(TaskBase):
    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned


class TaskCompleteRequest(BaseModel):
    """Body for PATCH /api/tasks/{id}/complete -- omit `completed` to toggle."""
    completed: Optional[bool] = None
