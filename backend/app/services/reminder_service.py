"""Ported from src/services/reminder.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import reminder_repository
from app.schemas.common import parse_optional_date
from app.utils.errors import AppError


def list_for_user(db: Session, organization_id: str, user_id: str):
    return reminder_repository.list_for_user(db, organization_id, user_id)


def upcoming(db: Session, organization_id: str, user_id: str):
    return reminder_repository.upcoming(db, organization_id, user_id)


def create(db: Session, organization_id: str, user_id: str, data):
    reminder_at = parse_optional_date(data.reminderAt)
    if not reminder_at:
        raise AppError("Reminder time is required", 400)
    return reminder_repository.create(db, organization_id, user_id, data, reminder_at)
