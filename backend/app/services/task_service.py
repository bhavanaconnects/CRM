"""Tasks module service layer.

Follows the same shape as lead_service / contact_service: the router stays
thin, tenant guards live here, and "not found" is raised as NotFoundError so
the shared error handler emits the {success: false, error} envelope.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.repositories import task_repository
from app.services.guards import (
    assert_company_in_org, assert_contact_in_org, assert_deal_in_org,
    assert_lead_in_org, assert_owner_in_org,
)
from app.utils.errors import NotFoundError


def _assert_relations(db: Session, organization_id: str, data):
    """Every foreign key a caller can supply must belong to their org."""
    assert_owner_in_org(db, organization_id, data.assigneeId)
    assert_lead_in_org(db, organization_id, data.leadId)
    assert_contact_in_org(db, organization_id, data.contactId)
    assert_company_in_org(db, organization_id, data.companyId)
    assert_deal_in_org(db, organization_id, data.dealId)


def list_tasks(db: Session, organization_id: str, **query):
    return task_repository.list_tasks(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, task_id: str):
    task = task_repository.find_by_id(db, organization_id, task_id)
    if not task:
        raise NotFoundError("Task")
    return task


def create(db: Session, organization_id: str, data):
    _assert_relations(db, organization_id, data)
    return task_repository.create(db, organization_id, data)


def update(db: Session, organization_id: str, task_id: str, data):
    _assert_relations(db, organization_id, data)
    task = task_repository.update(db, organization_id, task_id, data)
    if not task:
        raise NotFoundError("Task")
    return task


def set_completed(db: Session, organization_id: str, task_id: str,
                  completed: Optional[bool] = None):
    task = task_repository.set_completed(db, organization_id, task_id, completed)
    if not task:
        raise NotFoundError("Task")
    return task


def remove(db: Session, organization_id: str, task_id: str):
    if not task_repository.delete(db, organization_id, task_id):
        raise NotFoundError("Task")


def get_stats(db: Session, organization_id: str, assignee_id: Optional[str] = None):
    return task_repository.get_stats(db, organization_id, assignee_id)


def get_my_work(db: Session, organization_id: str, user_id: str):
    return task_repository.get_my_work(db, organization_id, user_id)
