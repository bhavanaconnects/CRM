"""
Ported from src/services/lead.service.ts, INCLUDING the lead-conversion
transaction (creates/reuses Company + Contact, optionally creates a
Deal, marks the lead CONVERTED, logs a NOTE activity) -- same dedup
rules as the original: match existing company by name, existing
contact by email/phone, before creating new ones.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.core import Activity, Company, Contact, Deal, Lead, Pipeline, PipelineStage
from app.repositories import lead_repository
from app.utils.errors import AppError, NotFoundError


def assert_company_in_org(db: Session, organization_id: str, company_id: str | None):
    if not company_id:
        return
    exists = db.query(Company).filter(Company.id == company_id, Company.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected company was not found", 400)


def list_leads(db, organization_id, **query):
    return lead_repository.list_leads(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, lead_id: str) -> Lead:
    lead = lead_repository.find_by_id(db, organization_id, lead_id)
    if not lead:
        raise NotFoundError("Lead")
    return lead


def create(db: Session, organization_id: str, created_by_id: str | None, data) -> Lead:
    assert_company_in_org(db, organization_id, data.companyId)
    return lead_repository.create(db, organization_id, created_by_id, data)


def update(db: Session, organization_id: str, lead_id: str, data) -> Lead:
    assert_company_in_org(db, organization_id, data.companyId)
    updated = lead_repository.update(db, organization_id, lead_id, data)
    if not updated:
        raise NotFoundError("Lead")
    return updated


def remove(db: Session, organization_id: str, lead_id: str):
    if not lead_repository.delete(db, organization_id, lead_id):
        raise NotFoundError("Lead")


def bulk_action(db: Session, organization_id: str, data):
    if data.action == "delete":
        return {"updated": lead_repository.bulk_delete(db, organization_id, data.ids)}
    if data.action == "assignOwner":
        if not data.ownerId:
            raise AppError("ownerId is required for assignOwner", 400)
        return {"updated": lead_repository.bulk_assign_owner(db, organization_id, data.ids, data.ownerId)}
    if data.action == "setStatus":
        if not data.status:
            raise AppError("status is required for setStatus", 400)
        return {"updated": lead_repository.bulk_set_status(db, organization_id, data.ids, data.status)}
    raise AppError("Unsupported bulk action", 400)


def convert(db: Session, organization_id: str, user_id: str, lead_id: str, data):
    """Runs as a single DB transaction (SQLAlchemy Session == unit of work)."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organizationId == organization_id).first()
    if not lead:
        raise NotFoundError("Lead")
    if lead.status == "CONVERTED":
        raise AppError("Lead has already been converted", 409)

    try:
        # --- Company ---------------------------------------------------
        company_id = lead.companyId
        company_input = data.company
        if company_input and company_input.mode == "existing" and company_input.companyId:
            existing = db.query(Company).filter(
                Company.id == company_input.companyId, Company.organizationId == organization_id
            ).first()
            if not existing:
                raise AppError("Selected company was not found", 400)
            company_id = existing.id
        elif not company_id and (not company_input or company_input.mode == "new"):
            name = (company_input.name.strip() if company_input and company_input.name else None) or (
                lead.companyName.strip() if lead.companyName else None
            )
            if name:
                existing = None
                for c in db.query(Company).filter(Company.organizationId == organization_id).all():
                    if c.name.lower() == name.lower():
                        existing = c
                        break
                if existing:
                    company_id = existing.id
                else:
                    created_company = Company(
                        organizationId=organization_id,
                        name=name,
                        industry=(company_input.industry if company_input else None) or None,
                        website=(company_input.website if company_input else None) or None,
                        phone=(company_input.phone if company_input else None) or lead.phone or None,
                    )
                    db.add(created_company)
                    db.flush()
                    company_id = created_company.id

        # --- Contact ---------------------------------------------------
        contact_id = lead.contactId
        contact_input = data.contact
        if contact_input and contact_input.mode == "existing" and contact_input.contactId:
            existing = db.query(Contact).filter(
                Contact.id == contact_input.contactId, Contact.organizationId == organization_id
            ).first()
            if not existing:
                raise AppError("Selected contact was not found", 400)
            contact_id = existing.id
        elif not contact_id and (not contact_input or contact_input.mode == "new"):
            existing = None
            if lead.email or lead.phone:
                q = db.query(Contact).filter(Contact.organizationId == organization_id)
                for c in q.all():
                    if (lead.email and c.email == lead.email) or (lead.phone and c.phone == lead.phone):
                        existing = c
                        break
            if existing:
                contact_id = existing.id
            else:
                created_contact = Contact(
                    organizationId=organization_id,
                    companyId=company_id,
                    ownerId=lead.ownerId,
                    firstName=lead.firstName,
                    lastName=lead.lastName,
                    email=lead.email,
                    phone=lead.phone,
                    jobTitle=lead.jobTitle,
                    source=lead.source,
                )
                db.add(created_contact)
                db.flush()
                contact_id = created_contact.id

        # --- Deal --------------------------------------------------------
        deal_id = None
        deal_input = data.deal
        if not deal_input or deal_input.create is not False:
            if deal_input and deal_input.pipelineId:
                pipeline = db.query(Pipeline).filter(
                    Pipeline.id == deal_input.pipelineId, Pipeline.organizationId == organization_id
                ).first()
            else:
                pipeline = (
                    db.query(Pipeline)
                    .filter(Pipeline.organizationId == organization_id)
                    .order_by(Pipeline.createdAt.asc())
                    .first()
                )
            if not pipeline:
                raise AppError(
                    "No sales pipeline exists for this organization yet. Create a pipeline before converting leads.",
                    409,
                )
            if deal_input and deal_input.stageId:
                stage = db.query(PipelineStage).filter(
                    PipelineStage.id == deal_input.stageId, PipelineStage.pipelineId == pipeline.id
                ).first()
            else:
                stage = (
                    db.query(PipelineStage)
                    .filter(PipelineStage.pipelineId == pipeline.id)
                    .order_by(PipelineStage.order.asc())
                    .first()
                )
            if not stage:
                raise AppError("The selected pipeline has no stages configured.", 409)

            deal = Deal(
                organizationId=organization_id,
                ownerId=lead.ownerId,
                companyId=company_id,
                contactId=contact_id,
                pipelineId=pipeline.id,
                stageId=stage.id,
                leadId=lead.id,
                title=(deal_input.title.strip() if deal_input and deal_input.title else None)
                or f"{lead.firstName} {lead.lastName} \u2014 New Opportunity",
                amount=(deal_input.amount if deal_input else None) or lead.estimatedValue or 0,
                expectedCloseDate=lead.expectedCloseDate,
            )
            db.add(deal)
            db.flush()
            deal_id = deal.id

        lead.status = "CONVERTED"
        lead.convertedAt = datetime.now(timezone.utc)
        lead.companyId = company_id
        lead.contactId = contact_id

        activity = Activity(
            organizationId=organization_id,
            userId=user_id,
            leadId=lead.id,
            contactId=contact_id,
            companyId=company_id,
            dealId=deal_id,
            type="NOTE",
            notes="Lead converted" + (" and a new deal was created." if deal_id else "."),
            occurredAt=datetime.now(timezone.utc),
        )
        db.add(activity)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"lead": lead, "companyId": company_id, "contactId": contact_id, "dealId": deal_id}
