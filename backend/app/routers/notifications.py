"""Ported from src/controllers/notification.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.notification import NotificationCreate
from app.schemas.serializers import notification as serialize_notification
from app.services import notification_service
from app.utils.errors import ok

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    items = notification_service.list_for_user(db, current.organization_id, current.id)
    unread = notification_service.unread_count(db, current.organization_id, current.id)
    return ok({"items": [serialize_notification(i) for i in items], "unreadCount": unread})


@router.post("")
def create_notification(payload: NotificationCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = notification_service.create(db, current.organization_id, payload)
    return ok(serialize_notification(item))


@router.patch("/read-all")
def mark_all_read(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(notification_service.mark_all_read(db, current.organization_id, current.id))


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = notification_service.mark_read(db, current.organization_id, current.id, notification_id)
    return ok(serialize_notification(item))
