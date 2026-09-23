"""Ported from src/controllers/contact.controller.ts + src/app/api/contacts/**."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.repositories import deal_repository
from app.schemas.contact import BulkContactAction, ContactCreate, ContactUpdate
from app.schemas.serializers import contact_detail, contact_summary
from app.services import contact_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
def list_contacts(
    page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100),
    status: str | None = None, source: str | None = None, ownerId: str | None = None,
    companyId: str | None = None, tag: str | None = None, search: str | None = None,
    sortBy: str = "createdAt", sortDir: str = "desc",
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    result = contact_service.list_contacts(
        db, current.organization_id, page=page, page_size=pageSize, status=status,
        source=source, owner_id=ownerId, company_id=companyId, tag=tag,
        search=search, sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [contact_summary(c) for c in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_contact(payload: ContactCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = contact_service.create(db, current.organization_id, payload)
    return created(contact_summary(contact))


@router.get("/duplicate-check")
def duplicate_check(
    email: str | None = None, phone: str | None = None,
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    match = contact_service.check_duplicate(db, current.organization_id, email, phone)
    return ok(
        {"id": match.id, "firstName": match.firstName, "lastName": match.lastName,
         "email": match.email, "phone": match.phone} if match else None
    )


@router.post("/bulk")
def bulk_action(payload: BulkContactAction, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(contact_service.bulk_action(db, current.organization_id, payload))


@router.get("/{contact_id}")
def get_contact(contact_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = contact_service.get_by_id(db, current.organization_id, contact_id)
    deals = deal_repository.list_deals(
        db, current.organization_id, page=1, page_size=100, contact_id=contact_id
    )["items"]
    return ok(contact_detail(contact, deals))


@router.put("/{contact_id}")
def update_contact(contact_id: str, payload: ContactUpdate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = contact_service.update(db, current.organization_id, contact_id, payload)
    return ok(contact_summary(contact))


@router.delete("/{contact_id}")
def delete_contact(contact_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    contact_service.remove(db, current.organization_id, contact_id)
    return ok({"deleted": True})
