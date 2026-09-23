"""Validators for the Work module.

WorkItem is its own entity -- separate from Task and Activity -- so it gets
its own schema module rather than extending theirs.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

WorkType = Literal["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "OTHER"]
WorkPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]
WorkStatus = Literal["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]

WORK_TYPES = ("CALL", "EMAIL", "MEETING", "TASK", "NOTE", "OTHER")
WORK_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "URGENT")
WORK_STATUSES = ("OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED")


class WorkItemBase(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    type: Optional[WorkType] = None
    priority: Optional[WorkPriority] = None
    status: Optional[WorkStatus] = None
    assigneeId: Optional[str] = None
    leadId: Optional[str] = None
    contactId: Optional[str] = None
    companyId: Optional[str] = None
    dealId: Optional[str] = None
    dueDate: Optional[str] = None

    @field_validator("description")
    @classmethod
    def strip_description(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


class WorkItemCreate(WorkItemBase):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned


class WorkItemUpdate(WorkItemBase):
    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned
