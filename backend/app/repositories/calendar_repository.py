"""Ported from src/services/calendar.service.ts (data access half)."""
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.core import CalendarEvent
from app.schemas.common import parse_optional_date

_OPTS = (
    joinedload(CalendarEvent.creator),
    joinedload(CalendarEvent.assignee),
    joinedload(CalendarEvent.user),
)

_NULLABLE = (
    "description", "location", "assignedUserId", "relatedLeadId",
    "relatedContactId", "relatedCompanyId", "relatedDealId", "relatedTaskId",
)


def list_events(db: Session, organization_id: str, start=None, end=None, related_deal_id=None):
    q = db.query(CalendarEvent).options(*_OPTS).filter(
        CalendarEvent.organizationId == organization_id
    )
    if start:
        parsed = parse_optional_date(start)
        if parsed:
            q = q.filter(CalendarEvent.startAt >= parsed)
    if end:
        parsed = parse_optional_date(end)
        if parsed:
            q = q.filter(CalendarEvent.startAt <= parsed)
    if related_deal_id:
        q = q.filter(CalendarEvent.relatedDealId == related_deal_id)
    return q.order_by(CalendarEvent.startAt.asc()).all()


def find_by_id(db: Session, organization_id: str, event_id: str) -> Optional[CalendarEvent]:
    return (
        db.query(CalendarEvent).options(*_OPTS)
        .filter(CalendarEvent.id == event_id, CalendarEvent.organizationId == organization_id)
        .first()
    )


def create(db: Session, organization_id: str, created_by_id: str, data) -> CalendarEvent:
    from datetime import datetime, timezone

    event = CalendarEvent(
        organizationId=organization_id,
        createdById=created_by_id,
        title=data.title,
        startAt=parse_optional_date(data.startAt) or datetime.now(timezone.utc),
        endAt=parse_optional_date(data.endAt),
        allDay=data.allDay if data.allDay is not None else False,
        eventType=data.eventType or "MEETING",
        status=data.status or "SCHEDULED",
        reminderMinutes=data.reminderMinutes,
        **{f: (getattr(data, f) or None) for f in _NULLABLE},
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update(db: Session, organization_id: str, event_id: str, data) -> Optional[CalendarEvent]:
    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id, CalendarEvent.organizationId == organization_id
    ).first()
    if not event:
        return None

    fields = data.model_dump(exclude_unset=True)
    if "startAt" in fields:
        fields["startAt"] = parse_optional_date(fields["startAt"]) or event.startAt
    if "endAt" in fields:
        fields["endAt"] = parse_optional_date(fields["endAt"])
    for key, value in fields.items():
        if key in _NULLABLE:
            value = value or None
        setattr(event, key, value)

    db.commit()
    db.refresh(event)
    return event


def delete(db: Session, organization_id: str, event_id: str) -> bool:
    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id, CalendarEvent.organizationId == organization_id
    ).first()
    if not event:
        return False
    db.delete(event)
    db.commit()
    return True
