"""Ported from src/services/calendar.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import calendar_repository
from app.services.guards import assert_deal_in_org
from app.utils.errors import AppError


def list_events(db: Session, organization_id: str, start=None, end=None, related_deal_id=None):
    return calendar_repository.list_events(db, organization_id, start, end, related_deal_id)


def get_by_id(db: Session, organization_id: str, event_id: str):
    event = calendar_repository.find_by_id(db, organization_id, event_id)
    if not event:
        raise AppError("Calendar event not found", 404)
    return event


def create(db: Session, organization_id: str, created_by_id: str, data):
    assert_deal_in_org(db, organization_id, data.relatedDealId)
    return calendar_repository.create(db, organization_id, created_by_id, data)


def update(db: Session, organization_id: str, event_id: str, data):
    existing = calendar_repository.find_by_id(db, organization_id, event_id)
    if not existing:
        raise AppError("Calendar event not found", 404)
    assert_deal_in_org(db, organization_id, data.relatedDealId)
    return calendar_repository.update(db, organization_id, event_id, data)


def remove(db: Session, organization_id: str, event_id: str):
    if not calendar_repository.delete(db, organization_id, event_id):
        raise AppError("Calendar event not found", 404)
    return {"deleted": True}
