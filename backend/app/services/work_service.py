"""Work module service layer.

Same shape as task_service / activity_service: the router stays thin,
tenant guards live here, and missing rows raise NotFoundError so the shared
handler emits the {success: false, error} envelope.
"""
from sqlalchemy.orm import Session

from app.repositories import work_repository
from app.services.guards import (
    assert_company_in_org, assert_contact_in_org, assert_deal_in_org,
    assert_lead_in_org, assert_owner_in_org,
)
from app.utils.errors import NotFoundError


def _assert_relations(db: Session, organization_id: str, data):
    assert_owner_in_org(db, organization_id, data.assigneeId)
    assert_lead_in_org(db, organization_id, data.leadId)
    assert_contact_in_org(db, organization_id, data.contactId)
    assert_company_in_org(db, organization_id, data.companyId)
    assert_deal_in_org(db, organization_id, data.dealId)


def list_work_items(db: Session, organization_id: str, **query):
    return work_repository.list_work_items(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, work_id: str):
    work = work_repository.find_by_id(db, organization_id, work_id)
    if not work:
        raise NotFoundError("Work item")
    return work


def create(db: Session, organization_id: str, data):
    _assert_relations(db, organization_id, data)
    return work_repository.create(db, organization_id, data)


def update(db: Session, organization_id: str, work_id: str, data):
    _assert_relations(db, organization_id, data)
    work = work_repository.update(db, organization_id, work_id, data)
    if not work:
        raise NotFoundError("Work item")
    return work


def remove(db: Session, organization_id: str, work_id: str):
    if not work_repository.delete(db, organization_id, work_id):
        raise NotFoundError("Work item")
