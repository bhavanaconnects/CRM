"""Activities module service layer.

Same shape as lead_service / task_service: the router stays thin, tenant
guards live here, and missing rows raise NotFoundError so the shared handler
emits the {success: false, error} envelope.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.repositories import activity_repository
from app.services.guards import (
    assert_company_in_org, assert_contact_in_org, assert_deal_in_org,
    assert_lead_in_org, assert_owner_in_org,
)
from app.utils.errors import NotFoundError


def _assert_relations(db: Session, organization_id: str, data):
    assert_owner_in_org(db, organization_id, getattr(data, "userId", None))
    assert_lead_in_org(db, organization_id, data.leadId)
    assert_contact_in_org(db, organization_id, data.contactId)
    assert_company_in_org(db, organization_id, data.companyId)
    assert_deal_in_org(db, organization_id, data.dealId)


def list_activities(db: Session, organization_id: str, **query):
    return activity_repository.list_activities(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, activity_id: str):
    activity = activity_repository.find_by_id(db, organization_id, activity_id)
    if not activity:
        raise NotFoundError("Activity")
    return activity


def create(db: Session, organization_id: str, user_id: str, data):
    _assert_relations(db, organization_id, data)
    return activity_repository.create(db, organization_id, user_id, data)


def update(db: Session, organization_id: str, activity_id: str, data):
    _assert_relations(db, organization_id, data)
    activity = activity_repository.update(db, organization_id, activity_id, data)
    if not activity:
        raise NotFoundError("Activity")
    return activity


def remove(db: Session, organization_id: str, activity_id: str):
    if not activity_repository.delete(db, organization_id, activity_id):
        raise NotFoundError("Activity")


def list_upcoming(db: Session, organization_id: str, user_id: Optional[str] = None,
                  limit: int = 10):
    return activity_repository.list_upcoming(db, organization_id, user_id, limit)


def list_recent(db: Session, organization_id: str, user_id: Optional[str] = None,
                limit: int = 10):
    return activity_repository.list_recent(db, organization_id, user_id, limit)
