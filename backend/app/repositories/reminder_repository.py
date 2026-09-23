"""Ported from src/services/reminder.service.ts (data access half)."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.core import Reminder
from app.schemas.common import parse_optional_date


def list_for_user(db: Session, organization_id: str, user_id: str, take: int = 50):
    return (
        db.query(Reminder)
        .filter(Reminder.organizationId == organization_id, Reminder.userId == user_id)
        .order_by(Reminder.reminderAt.asc())
        .limit(take)
        .all()
    )


def upcoming(db: Session, organization_id: str, user_id: str, take: int = 10):
    return (
        db.query(Reminder)
        .filter(
            Reminder.organizationId == organization_id,
            Reminder.userId == user_id,
            Reminder.reminderAt >= datetime.now(timezone.utc),
        )
        .order_by(Reminder.reminderAt.asc())
        .limit(take)
        .all()
    )


def create(db: Session, organization_id: str, user_id: str, data, reminder_at) -> Reminder:
    reminder = Reminder(
        organizationId=organization_id,
        userId=user_id,
        taskId=data.taskId or None,
        leadId=data.leadId or None,
        dealId=data.dealId or None,
        reminderAt=reminder_at,
        offset=data.offset or "MINUTES_15",
        targetType=data.targetType or "TASK",
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder
