"""Ported from src/services/contact.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import contact_repository
from app.services.guards import assert_company_in_org
from app.utils.errors import AppError, NotFoundError


def list_contacts(db: Session, organization_id: str, **query):
    return contact_repository.list_contacts(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, contact_id: str):
    contact = contact_repository.find_by_id(db, organization_id, contact_id)
    if not contact:
        raise NotFoundError("Contact")
    return contact


def create(db: Session, organization_id: str, data):
    assert_company_in_org(db, organization_id, data.companyId)
    return contact_repository.create(db, organization_id, data)


def check_duplicate(db: Session, organization_id: str, email=None, phone=None):
    return contact_repository.find_potential_duplicate(db, organization_id, email, phone)


def update(db: Session, organization_id: str, contact_id: str, data):
    assert_company_in_org(db, organization_id, data.companyId)
    updated = contact_repository.update(db, organization_id, contact_id, data)
    if not updated:
        raise NotFoundError("Contact")
    return updated


def remove(db: Session, organization_id: str, contact_id: str):
    if not contact_repository.delete(db, organization_id, contact_id):
        raise NotFoundError("Contact")


def bulk_action(db: Session, organization_id: str, data):
    if data.action == "delete":
        return {"updated": contact_repository.bulk_delete(db, organization_id, data.ids)}
    if data.action == "assignOwner":
        if not data.ownerId:
            raise AppError("ownerId is required for assignOwner", 400)
        return {"updated": contact_repository.bulk_assign_owner(db, organization_id, data.ids, data.ownerId)}
    if data.action == "setStatus":
        if not data.status:
            raise AppError("status is required for setStatus", 400)
        return {"updated": contact_repository.bulk_set_status(db, organization_id, data.ids, data.status)}
    raise AppError("Unsupported bulk action", 400)
