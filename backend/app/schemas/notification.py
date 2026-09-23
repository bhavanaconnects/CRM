"""Ported from src/validators/notification.ts."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

NotificationType = Literal[
    "TASK_DUE", "TASK_OVERDUE", "UPCOMING_MEETING", "FOLLOW_UP_DUE", "DEAL_STAGE_CHANGED",
    "DEAL_WON", "DEAL_LOST", "LEAD_ASSIGNED", "TASK_ASSIGNED", "MENTION", "SYSTEM_NOTIFICATION",
]


class NotificationCreate(BaseModel):
    userId: str
    type: NotificationType
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=500)
    relatedEntity: Optional[str] = Field(default=None, max_length=100)
    relatedEntityId: Optional[str] = Field(default=None, max_length=100)
