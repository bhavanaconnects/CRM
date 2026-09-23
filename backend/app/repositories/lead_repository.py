"""Ported from src/repositories/lead.repository.ts."""
from datetime import datetime
from typing import Optional

from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload

from app.models.core import Company, Contact, Lead, User
from app.models.core import _utcnow
from app.schemas.common import parse_optional_date

SORTABLE = {"createdAt", "updatedAt", "firstName", "estimatedValue", "expectedCloseDate"}


def list_leads(
    db: Session, organization_id: str, page: int, page_size: int,
    status=None, source=None, priority=None, owner_id=None, search=None,
    sort_by="createdAt", sort_dir="desc",
):
    q = db.query(Lead).options(
        joinedload(Lead.owner), joinedload(Lead.createdBy),
        joinedload(Lead.company), joinedload(Lead.contact),
    ).filter(Lead.organizationId == organization_id)

    if status:
        q = q.filter(Lead.status == status)
    if source:
        q = q.filter(Lead.source == source)
    if priority:
        q = q.filter(Lead.priority == priority)
    if owner_id:
        q = q.filter(Lead.ownerId == owner_id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Lead.firstName.ilike(like),
            Lead.lastName.ilike(like),
            Lead.companyName.ilike(like),
            Lead.email.ilike(like),
            Lead.phone.ilike(like),
            Lead.tags.any(search),
        ))

    total = q.count()

    sort_field = sort_by if sort_by in SORTABLE else "createdAt"
    column = getattr(Lead, sort_field)
    column = column.desc() if sort_dir == "desc" else column.asc()

    items = q.order_by(column).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, lead_id: str) -> Optional[Lead]:
    return (
        db.query(Lead)
        .options(
            joinedload(Lead.owner), joinedload(Lead.createdBy),
            joinedload(Lead.company), joinedload(Lead.contact),
            joinedload(Lead.deal), joinedload(Lead.tasks), joinedload(Lead.activities),
        )
        .filter(Lead.id == lead_id, Lead.organizationId == organization_id)
        .first()
    )


def create(db: Session, organization_id: str, created_by_id: Optional[str], data) -> Lead:
    lead = Lead(
        organizationId=organization_id,
        createdById=created_by_id,
        firstName=data.firstName,
        lastName=data.lastName,
        email=data.email or None,
        phone=data.phone or None,
        companyName=data.companyName or None,
        companyId=data.companyId or None,
        jobTitle=data.jobTitle or None,
        source=data.source or "OTHER",
        status=data.status or "NEW",
        priority=data.priority or "MEDIUM",
        ownerId=data.ownerId or None,
        estimatedValue=data.estimatedValue,
        expectedCloseDate=parse_optional_date(data.expectedCloseDate),
        notes=data.notes or None,
        tags=data.tags or [],
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update(db: Session, organization_id: str, lead_id: str, data) -> Optional[Lead]:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organizationId == organization_id).first()
    if not lead:
        return None

    fields = data.model_dump(exclude_unset=True)
    if "expectedCloseDate" in fields:
        fields["expectedCloseDate"] = parse_optional_date(fields["expectedCloseDate"])
    for key, value in fields.items():
        if key in ("email", "phone", "companyName", "companyId", "jobTitle", "notes"):
            value = value or None
        setattr(lead, key, value)

    db.commit()
    db.refresh(lead)
    return lead


def delete(db: Session, organization_id: str, lead_id: str) -> bool:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organizationId == organization_id).first()
    if not lead:
        return False
    db.delete(lead)
    db.commit()
    return True


def bulk_delete(db: Session, organization_id: str, ids: list[str]) -> int:
    count = (
        db.query(Lead)
        .filter(Lead.id.in_(ids), Lead.organizationId == organization_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return count


def bulk_assign_owner(db: Session, organization_id: str, ids: list[str], owner_id: str) -> int:
    count = (
        db.query(Lead)
        .filter(Lead.id.in_(ids), Lead.organizationId == organization_id)
        .update({"ownerId": owner_id, "updatedAt": _utcnow()}, synchronize_session=False)
    )
    db.commit()
    return count


def bulk_set_status(db: Session, organization_id: str, ids: list[str], status: str) -> int:
    count = (
        db.query(Lead)
        .filter(Lead.id.in_(ids), Lead.organizationId == organization_id)
        .update({"status": status, "updatedAt": _utcnow()}, synchronize_session=False)
    )
    db.commit()
    return count
