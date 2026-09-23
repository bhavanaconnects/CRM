"""Ported from src/repositories/deal.repository.ts."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Company, Contact, Deal
from app.schemas.common import parse_optional_date

_OPTS = (
    joinedload(Deal.owner), joinedload(Deal.company), joinedload(Deal.contact),
    joinedload(Deal.pipeline), joinedload(Deal.stage),
)

_SORT = {
    "title": Deal.title, "amount": Deal.amount, "probability": Deal.probability,
    "expectedCloseDate": Deal.expectedCloseDate, "updatedAt": Deal.updatedAt,
    "createdAt": Deal.createdAt,
}


def _apply_filters(db, q, organization_id, status=None, stage_id=None, pipeline_id=None,
                   owner_id=None, company_id=None, contact_id=None, search=None):
    q = q.filter(Deal.organizationId == organization_id)
    if status:
        q = q.filter(Deal.status == status)
    if stage_id:
        q = q.filter(Deal.stageId == stage_id)
    if pipeline_id:
        q = q.filter(Deal.pipelineId == pipeline_id)
    if owner_id:
        q = q.filter(Deal.ownerId == owner_id)
    if company_id:
        q = q.filter(Deal.companyId == company_id)
    if contact_id:
        q = q.filter(Deal.contactId == contact_id)
    if search:
        like = f"%{search}%"
        company_ids = [c.id for c in db.query(Company).filter(
            Company.organizationId == organization_id, Company.name.ilike(like)).all()]
        contact_ids = [c.id for c in db.query(Contact).filter(
            Contact.organizationId == organization_id,
            or_(Contact.firstName.ilike(like), Contact.lastName.ilike(like))).all()]
        conditions = [Deal.title.ilike(like)]
        if company_ids:
            conditions.append(Deal.companyId.in_(company_ids))
        if contact_ids:
            conditions.append(Deal.contactId.in_(contact_ids))
        q = q.filter(or_(*conditions))
    return q


def list_deals(db: Session, organization_id: str, page: int, page_size: int,
               status=None, stage_id=None, pipeline_id=None, owner_id=None,
               company_id=None, contact_id=None, search=None,
               sort_by="createdAt", sort_dir="desc"):
    q = _apply_filters(db, db.query(Deal).options(*_OPTS), organization_id, status,
                       stage_id, pipeline_id, owner_id, company_id, contact_id, search)
    total = q.count()
    col = _SORT.get(sort_by, Deal.createdAt)
    col = col.desc() if sort_dir == "desc" else col.asc()
    items = q.order_by(col).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def board(db: Session, organization_id: str, pipeline_id=None, owner_id=None,
          company_id=None, search=None):
    """Unpaginated fetch of every matching deal, for the kanban board."""
    q = _apply_filters(db, db.query(Deal).options(*_OPTS), organization_id,
                       pipeline_id=pipeline_id, owner_id=owner_id,
                       company_id=company_id, search=search)
    return q.order_by(Deal.stageId.asc(), Deal.createdAt.desc()).all()


def find_by_id(db: Session, organization_id: str, deal_id: str) -> Optional[Deal]:
    return (
        db.query(Deal)
        .options(*_OPTS, joinedload(Deal.tasks), joinedload(Deal.activities))
        .filter(Deal.id == deal_id, Deal.organizationId == organization_id)
        .first()
    )


def exists_for_org(db: Session, organization_id: str, deal_id: str) -> bool:
    return db.query(Deal.id).filter(
        Deal.id == deal_id, Deal.organizationId == organization_id
    ).first() is not None


def create(db: Session, organization_id: str, data) -> Deal:
    status = data.status or "OPEN"
    deal = Deal(
        organizationId=organization_id,
        title=data.title,
        amount=data.amount,
        probability=data.probability,
        status=status,
        pipelineId=data.pipelineId,
        stageId=data.stageId,
        ownerId=data.ownerId or None,
        companyId=data.companyId or None,
        contactId=data.contactId or None,
        expectedCloseDate=parse_optional_date(data.expectedCloseDate),
        closedAt=datetime.now(timezone.utc) if status in ("WON", "LOST") else None,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


def update(db: Session, organization_id: str, deal_id: str, data) -> Optional[Deal]:
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organizationId == organization_id
    ).first()
    if not deal:
        return None

    fields = data.model_dump(exclude_unset=True)
    previous_status = deal.status
    next_status = fields.get("status", previous_status)

    changed_to_closed = (
        "status" in fields and next_status != previous_status and next_status in ("WON", "LOST")
    )
    reopened = "status" in fields and next_status == "OPEN" and previous_status != "OPEN"

    if "expectedCloseDate" in fields:
        fields["expectedCloseDate"] = parse_optional_date(fields["expectedCloseDate"])
    for key, value in fields.items():
        if key in ("ownerId", "companyId", "contactId"):
            value = value or None
        setattr(deal, key, value)

    if changed_to_closed:
        deal.closedAt = datetime.now(timezone.utc)
    if reopened:
        deal.closedAt = None

    db.commit()
    db.refresh(deal)
    return deal


def change_stage(db: Session, organization_id: str, deal_id: str, data) -> Optional[Deal]:
    """Lightweight stage move for the kanban board's drag-and-drop."""
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organizationId == organization_id
    ).first()
    if not deal:
        return None

    previous_status = deal.status
    next_status = data.status or previous_status
    closing = data.status is not None and next_status != previous_status and next_status != "OPEN"
    reopening = data.status is not None and next_status == "OPEN" and previous_status != "OPEN"

    deal.stageId = data.stageId
    if data.status is not None:
        deal.status = data.status
    if closing:
        deal.closedAt = datetime.now(timezone.utc)
    if reopening:
        deal.closedAt = None

    db.commit()
    db.refresh(deal)
    return deal


def delete(db: Session, organization_id: str, deal_id: str) -> bool:
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organizationId == organization_id
    ).first()
    if not deal:
        return False
    db.delete(deal)
    db.commit()
    return True
