"""Ported from src/validators/reminder.ts."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

ReminderOffset = Literal["MINUTES_5", "MINUTES_15", "MINUTES_30", "HOURS_1", "DAYS_1"]
ReminderTargetType = Literal["TASK", "MEETING", "FOLLOW_UP", "DEAL_CLOSE_DATE"]


class ReminderCreate(BaseModel):
    taskId: Optional[str] = None
    leadId: Optional[str] = None
    dealId: Optional[str] = None
    reminderAt: str = Field(min_length=1)
    offset: Optional[ReminderOffset] = None
    targetType: Optional[ReminderTargetType] = None
