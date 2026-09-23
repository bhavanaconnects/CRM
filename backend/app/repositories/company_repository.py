"""
Ported from src/repositories/company.repository.ts.

The frontend expects a `counts` object ({contacts, deals}); Prisma
returned these as `_count`. Here the counts are computed with scalar
subqueries and attached by the serializer.
"""
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Company, Contact, Deal


def _order_by(sort_by: str, sort_dir: str):
    desc = sort_dir == "desc"
    col = {"name": Company.name, "industry": Company.industry}.get(sort_by, Company.createdAt)
    return col.desc() if desc else col.asc()


def count_contacts(db: Session, company_id: str) -> int:
    return db.query(func.count(Contact.id)).filter(Contact.companyId == company_id).scalar() or 0


def count_deals(db: Session, company_id: str) -> int:
    return db.query(func.count(Deal.id)).filter(Deal.companyId == company_id).scalar() or 0


def list_companies(db: Session, organization_id: str, page: int, page_size: int,
                   owner_id=None, industry=None, search=None,
                   sort_by="createdAt", sort_dir="desc"):
    q = db.query(Company).options(joinedload(Company.owner)).filter(
        Company.organizationId == organization_id
    )
    if owner_id:
        q = q.filter(Company.ownerId == owner_id)
    if industry:
        q = q.filter(func.lower(Company.industry) == industry.lower())
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Company.name.ilike(like), Company.industry.ilike(like),
            Company.website.ilike(like), Company.phone.ilike(like),
        ))

    total = q.count()
    items = q.order_by(_order_by(sort_by, sort_dir)).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, company_id: str) -> Optional[Company]:
    return (
        db.query(Company)
        .options(
            joinedload(Company.owner), joinedload(Company.contacts),
            joinedload(Company.deals), joinedload(Company.tasks),
            joinedload(Company.activities), joinedload(Company.leads),
        )
        .filter(Company.id == company_id, Company.organizationId == organization_id)
        .first()
    )


def exists_for_org(db: Session, organization_id: str, company_id: str) -> bool:
    return db.query(Company.id).filter(
        Company.id == company_id, Company.organizationId == organization_id
    ).first() is not None


def find_by_name(db: Session, organization_id: str, name: str) -> Optional[Company]:
    """Duplicate check used by the create flow (case-insensitive exact name match)."""
    return db.query(Company).filter(
        Company.organizationId == organization_id,
        func.lower(Company.name) == name.lower(),
    ).first()


def create(db: Session, organization_id: str, data) -> Company:
    company = Company(
        organizationId=organization_id,
        name=data.name,
        industry=data.industry or None,
        website=data.website or None,
        phone=data.phone or None,
        ownerId=data.ownerId or None,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def update(db: Session, organization_id: str, company_id: str, data) -> Optional[Company]:
    company = db.query(Company).filter(
        Company.id == company_id, Company.organizationId == organization_id
    ).first()
    if not company:
        return None
    fields = data.model_dump(exclude_unset=True)
    for key, value in fields.items():
        if key in ("industry", "website", "phone", "ownerId"):
            value = value or None
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


def delete(db: Session, organization_id: str, company_id: str) -> bool:
    company = db.query(Company).filter(
        Company.id == company_id, Company.organizationId == organization_id
    ).first()
    if not company:
        return False
    db.delete(company)
    db.commit()
    return True
