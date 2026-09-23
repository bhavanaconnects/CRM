"""Ported from src/services/notification.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import notification_repository
from app.utils.errors import NotFoundError


def list_for_user(db: Session, organization_id: str, user_id: str):
    return notification_repository.list_for_user(db, organization_id, user_id)


def unread_count(db: Session, organization_id: str, user_id: str):
    return notification_repository.unread_count(db, organization_id, user_id)


def mark_read(db: Session, organization_id: str, user_id: str, notification_id: str):
    item = notification_repository.mark_read(db, organization_id, user_id, notification_id)
    if not item:
        raise NotFoundError("Notification")
    return item


def mark_all_read(db: Session, organization_id: str, user_id: str):
    return {"count": notification_repository.mark_all_read(db, organization_id, user_id)}


def create(db: Session, organization_id: str, data):
    return notification_repository.create(db, organization_id, data)
