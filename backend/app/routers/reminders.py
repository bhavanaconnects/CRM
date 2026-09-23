"""Ported from src/controllers/reminder.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.reminder import ReminderCreate
from app.schemas.serializers import reminder as serialize_reminder
from app.services import reminder_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("")
def list_reminders(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    items = reminder_service.list_for_user(db, current.organization_id, current.id)
    return ok([serialize_reminder(i) for i in items])


@router.post("")
def create_reminder(payload: ReminderCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = reminder_service.create(db, current.organization_id, current.id, payload)
    return created(serialize_reminder(item))
