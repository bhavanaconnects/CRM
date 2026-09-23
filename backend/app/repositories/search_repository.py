"""Ported from src/services/search.service.ts."""
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Activity, Company, Contact, Deal, Lead, Task

TAKE = 6


def search_all(db: Session, organization_id: str, q: str):
    like = f"%{q}%"

    leads = (
        db.query(Lead).options(joinedload(Lead.owner))
        .filter(Lead.organizationId == organization_id, or_(
            Lead.firstName.ilike(like), Lead.lastName.ilike(like),
            Lead.email.ilike(like), Lead.companyName.ilike(like), Lead.phone.ilike(like)))
        .order_by(Lead.createdAt.desc()).limit(TAKE).all()
    )

    company_ids = [c.id for c in db.query(Company).filter(
        Company.organizationId == organization_id, Company.name.ilike(like)).all()]

    contact_conditions = [
        Contact.firstName.ilike(like), Contact.lastName.ilike(like),
        Contact.email.ilike(like), Contact.phone.ilike(like),
        Contact.jobTitle.ilike(like), Contact.tags.any(q),
    ]
    if company_ids:
        contact_conditions.append(Contact.companyId.in_(company_ids))
    contacts = (
        db.query(Contact).options(joinedload(Contact.company))
        .filter(Contact.organizationId == organization_id, or_(*contact_conditions))
        .order_by(Contact.createdAt.desc()).limit(TAKE).all()
    )

    companies = (
        db.query(Company)
        .filter(Company.organizationId == organization_id, or_(
            Company.name.ilike(like), Company.industry.ilike(like), Company.website.ilike(like)))
        .order_by(Company.createdAt.desc()).limit(TAKE).all()
    )

    deal_conditions = [Deal.title.ilike(like)]
    if company_ids:
        deal_conditions.append(Deal.companyId.in_(company_ids))
    deals = (
        db.query(Deal).options(joinedload(Deal.company))
        .filter(Deal.organizationId == organization_id, or_(*deal_conditions))
        .order_by(Deal.createdAt.desc()).limit(TAKE).all()
    )

    from app.models.core import User
    assignee_ids = [u.id for u in db.query(User).filter(
        User.organizationId == organization_id, User.name.ilike(like)).all()]
    task_conditions = [Task.title.ilike(like), Task.description.ilike(like)]
    if assignee_ids:
        task_conditions.append(Task.assigneeId.in_(assignee_ids))
    tasks = (
        db.query(Task).options(joinedload(Task.assignee))
        .filter(Task.organizationId == organization_id, or_(*task_conditions))
        .order_by(Task.dueDate.asc()).limit(TAKE).all()
    )

    activities = (
        db.query(Activity)
        .options(joinedload(Activity.lead), joinedload(Activity.contact),
                 joinedload(Activity.company), joinedload(Activity.user))
        .filter(Activity.organizationId == organization_id, Activity.notes.ilike(like))
        .order_by(Activity.occurredAt.desc()).limit(TAKE).all()
    )

    return {
        "leads": leads, "contacts": contacts, "companies": companies,
        "deals": deals, "tasks": tasks, "activities": activities,
    }
