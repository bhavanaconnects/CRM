"""Ported from src/services/company.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import company_repository
from app.services.guards import assert_owner_in_org
from app.utils.errors import NotFoundError


def list_companies(db: Session, organization_id: str, **query):
    return company_repository.list_companies(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, company_id: str):
    company = company_repository.find_by_id(db, organization_id, company_id)
    if not company:
        raise NotFoundError("Company")
    return company


def create(db: Session, organization_id: str, data):
    assert_owner_in_org(db, organization_id, data.ownerId)
    return company_repository.create(db, organization_id, data)


def check_duplicate(db: Session, organization_id: str, name: str):
    return company_repository.find_by_name(db, organization_id, name)


def update(db: Session, organization_id: str, company_id: str, data):
    assert_owner_in_org(db, organization_id, data.ownerId)
    updated = company_repository.update(db, organization_id, company_id, data)
    if not updated:
        raise NotFoundError("Company")
    return updated


def remove(db: Session, organization_id: str, company_id: str):
    if not company_repository.delete(db, organization_id, company_id):
        raise NotFoundError("Company")
