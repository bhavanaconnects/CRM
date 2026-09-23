"""Ported from src/validators/calendar.ts."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

CalendarEventType = Literal["CALL", "MEETING", "DEMO", "FOLLOW_UP", "TASK", "OTHER"]
CalendarEventStatus = Literal["DRAFT", "SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"]


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    return v.strip() if isinstance(v, str) else v


class CalendarEventBase(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=4000)
    startAt: Optional[str] = None
    endAt: Optional[str] = None
    allDay: Optional[bool] = None
    location: Optional[str] = Field(default=None, max_length=300)
    eventType: Optional[CalendarEventType] = None
    status: Optional[CalendarEventStatus] = None
    reminderMinutes: Optional[int] = Field(default=None, ge=0, le=10080)
    assignedUserId: Optional[str] = None
    relatedLeadId: Optional[str] = None
    relatedContactId: Optional[str] = None
    relatedCompanyId: Optional[str] = None
    relatedDealId: Optional[str] = None
    relatedTaskId: Optional[str] = None

    @field_validator(
        "description", "endAt", "location", "assignedUserId", "relatedLeadId",
        "relatedContactId", "relatedCompanyId", "relatedDealId", "relatedTaskId",
        mode="before",
    )
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)


class CalendarEventCreate(CalendarEventBase):
    title: str = Field(min_length=1, max_length=300)
    startAt: str = Field(min_length=1)


class CalendarEventUpdate(CalendarEventBase):
    pass
