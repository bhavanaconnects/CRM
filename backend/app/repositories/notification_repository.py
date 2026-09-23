"""Ported from src/services/notification.service.ts (data access half)."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.core import Notification


def list_for_user(db: Session, organization_id: str, user_id: str, take: int = 50):
    return (
        db.query(Notification)
        .filter(Notification.organizationId == organization_id, Notification.userId == user_id)
        .order_by(Notification.createdAt.desc())
        .limit(take)
        .all()
    )


def unread_count(db: Session, organization_id: str, user_id: str) -> int:
    return db.query(Notification).filter(
        Notification.organizationId == organization_id,
        Notification.userId == user_id,
        Notification.read.is_(False),
    ).count()


def mark_read(db: Session, organization_id: str, user_id: str, notification_id: str):
    item = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.organizationId == organization_id,
        Notification.userId == user_id,
    ).first()
    if not item:
        return None
    item.read = True
    item.readAt = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


def mark_all_read(db: Session, organization_id: str, user_id: str) -> int:
    count = db.query(Notification).filter(
        Notification.organizationId == organization_id,
        Notification.userId == user_id,
        Notification.read.is_(False),
    ).update({"read": True, "readAt": datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return count


def create(db: Session, organization_id: str, data) -> Notification:
    notification = Notification(
        organizationId=organization_id,
        userId=data.userId,
        type=data.type,
        title=data.title,
        message=data.message,
        relatedEntity=data.relatedEntity or None,
        relatedEntityId=data.relatedEntityId or None,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
