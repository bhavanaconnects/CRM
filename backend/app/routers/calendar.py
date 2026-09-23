"""Ported from src/controllers/calendar.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate
from app.schemas.serializers import calendar_event
from app.services import calendar_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("")
def list_events(
    start: str | None = None, end: str | None = None, relatedDealId: str | None = None,
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    events = calendar_service.list_events(db, current.organization_id, start, end, relatedDealId)
    return ok([calendar_event(e) for e in events])


@router.post("")
def create_event(payload: CalendarEventCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    event = calendar_service.create(db, current.organization_id, current.id, payload)
    return created(calendar_event(event))


@router.get("/{event_id}")
def get_event(event_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(calendar_event(calendar_service.get_by_id(db, current.organization_id, event_id)))


@router.put("/{event_id}")
def update_event(event_id: str, payload: CalendarEventUpdate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    event = calendar_service.update(db, current.organization_id, event_id, payload)
    return ok(calendar_event(event))


@router.delete("/{event_id}")
def delete_event(event_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(calendar_service.remove(db, current.organization_id, event_id))
