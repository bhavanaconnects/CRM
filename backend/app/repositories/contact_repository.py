"""Ported from src/repositories/contact.repository.ts."""
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Company, Contact, _utcnow
from app.schemas.common import parse_optional_date

_LIST_OPTS = (joinedload(Contact.owner), joinedload(Contact.company))


def _order_by(sort_by: str, sort_dir: str):
    desc = sort_dir == "desc"

    def d(col):
        return col.desc() if desc else col.asc()

    if sort_by == "name":
        return [d(Contact.firstName), d(Contact.lastName)]
    if sort_by == "company":
        return [d(Company.name)]
    if sort_by == "lastContactedAt":
        return [d(Contact.lastContactedAt)]
    return [d(Contact.createdAt)]


def list_contacts(db: Session, organization_id: str, page: int, page_size: int,
                  status=None, source=None, owner_id=None, company_id=None,
                  tag=None, search=None, sort_by="createdAt", sort_dir="desc"):
    q = db.query(Contact).options(*_LIST_OPTS).filter(Contact.organizationId == organization_id)

    if sort_by == "company":
        q = q.outerjoin(Company, Contact.companyId == Company.id)

    if status:
        q = q.filter(Contact.status == status)
    if source:
        q = q.filter(Contact.source == source)
    if owner_id:
        q = q.filter(Contact.ownerId == owner_id)
    if company_id:
        q = q.filter(Contact.companyId == company_id)
    if tag:
        q = q.filter(Contact.tags.any(tag))
    if search:
        like = f"%{search}%"
        company_ids = [
            c.id for c in db.query(Company)
            .filter(Company.organizationId == organization_id, Company.name.ilike(like)).all()
        ]
        conditions = [
            Contact.firstName.ilike(like), Contact.lastName.ilike(like),
            Contact.email.ilike(like), Contact.phone.ilike(like),
            Contact.mobilePhone.ilike(like), Contact.jobTitle.ilike(like),
            Contact.tags.any(search),
        ]
        if company_ids:
            conditions.append(Contact.companyId.in_(company_ids))
        q = q.filter(or_(*conditions))

    total = q.count()
    items = q.order_by(*_order_by(sort_by, sort_dir)).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, contact_id: str) -> Optional[Contact]:
    return (
        db.query(Contact)
        .options(
            *_LIST_OPTS,
            joinedload(Contact.tasks), joinedload(Contact.activities),
            joinedload(Contact.leads), joinedload(Contact.deals),
        )
        .filter(Contact.id == contact_id, Contact.organizationId == organization_id)
        .first()
    )


def find_potential_duplicate(db: Session, organization_id: str, email=None, phone=None):
    """Duplicate check used by the create flow (email or phone match within the org)."""
    if not email and not phone:
        return None
    q = db.query(Contact).filter(Contact.organizationId == organization_id)
    conditions = []
    if email:
        conditions.append(Contact.email == email)
    if phone:
        conditions.append(Contact.phone == phone)
    return q.filter(or_(*conditions)).first()


def exists_for_org(db: Session, organization_id: str, contact_id: str) -> bool:
    return db.query(Contact.id).filter(
        Contact.id == contact_id, Contact.organizationId == organization_id
    ).first() is not None


_NULLABLE = (
    "jobTitle", "email", "phone", "mobilePhone", "companyId", "ownerId",
    "address", "city", "state", "country", "postalCode", "website",
    "linkedinUrl", "notes",
)


def create(db: Session, organization_id: str, data) -> Contact:
    contact = Contact(
        organizationId=organization_id,
        firstName=data.firstName,
        lastName=data.lastName,
        status=data.status or "ACTIVE",
        source=data.source or "OTHER",
        tags=data.tags or [],
        lastContactedAt=parse_optional_date(data.lastContactedAt),
        **{f: (getattr(data, f) or None) for f in _NULLABLE},
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def update(db: Session, organization_id: str, contact_id: str, data) -> Optional[Contact]:
    contact = db.query(Contact).filter(
        Contact.id == contact_id, Contact.organizationId == organization_id
    ).first()
    if not contact:
        return None

    fields = data.model_dump(exclude_unset=True)
    if "lastContactedAt" in fields:
        fields["lastContactedAt"] = parse_optional_date(fields["lastContactedAt"])
    for key, value in fields.items():
        if key in _NULLABLE:
            value = value or None
        setattr(contact, key, value)

    db.commit()
    db.refresh(contact)
    return contact


def delete(db: Session, organization_id: str, contact_id: str) -> bool:
    contact = db.query(Contact).filter(
        Contact.id == contact_id, Contact.organizationId == organization_id
    ).first()
    if not contact:
        return False
    db.delete(contact)
    db.commit()
    return True


def bulk_delete(db: Session, organization_id: str, ids: list[str]) -> int:
    count = db.query(Contact).filter(
        Contact.id.in_(ids), Contact.organizationId == organization_id
    ).delete(synchronize_session=False)
    db.commit()
    return count


def bulk_assign_owner(db: Session, organization_id: str, ids: list[str], owner_id: str) -> int:
    count = db.query(Contact).filter(
        Contact.id.in_(ids), Contact.organizationId == organization_id
    ).update({"ownerId": owner_id, "updatedAt": _utcnow()}, synchronize_session=False)
    db.commit()
    return count


def bulk_set_status(db: Session, organization_id: str, ids: list[str], status: str) -> int:
    count = db.query(Contact).filter(
        Contact.id.in_(ids), Contact.organizationId == organization_id
    ).update({"status": status, "updatedAt": _utcnow()}, synchronize_session=False)
    db.commit()
    return count
