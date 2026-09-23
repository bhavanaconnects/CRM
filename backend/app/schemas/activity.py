"""Activity validators.

Extends the original create-only schema with subject, status, duration and a
partial update model. `subject` is intentionally OPTIONAL so the quick-log
forms on the Lead/Contact/Company/Deal pages (and any existing API caller)
keep working; the repository derives one from the activity type when it is
omitted.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ActivityType = Literal["CALL", "MEETING", "EMAIL", "WHATSAPP", "NOTE", "FOLLOW_UP"]
ActivityStatus = Literal["PLANNED", "COMPLETED", "CANCELLED"]

ACTIVITY_TYPES = ("CALL", "MEETING", "EMAIL", "WHATSAPP", "NOTE", "FOLLOW_UP")
ACTIVITY_STATUSES = ("PLANNED", "COMPLETED", "CANCELLED")

# Duration only makes sense for time-boxed activity types.
DURATION_TYPES = ("CALL", "MEETING")


class ActivityBase(BaseModel):
    subject: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[ActivityStatus] = None
    durationMinutes: Optional[int] = Field(default=None, ge=0, le=100000)
    userId: Optional[str] = None
    leadId: Optional[str] = None
    contactId: Optional[str] = None
    companyId: Optional[str] = None
    dealId: Optional[str] = None
    occurredAt: Optional[str] = None

    @field_validator("subject", "notes")
    @classmethod
    def strip_blank(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


class ActivityCreate(ActivityBase):
    type: ActivityType
    notes: str = Field(min_length=1, max_length=4000)

    @field_validator("notes")
    @classmethod
    def notes_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Notes are required")
        return cleaned


class ActivityUpdate(ActivityBase):
    type: Optional[ActivityType] = None
