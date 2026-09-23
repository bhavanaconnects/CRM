"""
Shared tenant-ownership guards.

Ported from the assertXInOrg helpers repeated across the Next.js
services. Every one of these enforces that a foreign key supplied by a
caller actually belongs to the caller's organization, which is what
keeps the multi-tenant isolation intact on writes.
"""
from sqlalchemy.orm import Session

from app.models.core import Company, Contact, Deal, Lead, Pipeline, PipelineStage, User
from app.utils.errors import AppError


def assert_owner_in_org(db: Session, organization_id: str, owner_id):
    if not owner_id:
        return
    exists = db.query(User.id).filter(
        User.id == owner_id, User.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected owner was not found", 400)


def assert_company_in_org(db: Session, organization_id: str, company_id):
    if not company_id:
        return
    exists = db.query(Company.id).filter(
        Company.id == company_id, Company.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected company was not found", 400)


def assert_contact_in_org(db: Session, organization_id: str, contact_id):
    if not contact_id:
        return
    exists = db.query(Contact.id).filter(
        Contact.id == contact_id, Contact.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected contact was not found", 400)


def assert_lead_in_org(db: Session, organization_id: str, lead_id):
    if not lead_id:
        return
    exists = db.query(Lead.id).filter(
        Lead.id == lead_id, Lead.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected lead was not found", 400)


def assert_deal_in_org(db: Session, organization_id: str, deal_id):
    if not deal_id:
        return
    exists = db.query(Deal.id).filter(
        Deal.id == deal_id, Deal.organizationId == organization_id).first()
    if not exists:
        raise AppError("Selected deal was not found", 400)


def assert_stage_in_pipeline(db: Session, organization_id: str, pipeline_id: str, stage_id: str):
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id, Pipeline.organizationId == organization_id).first()
    if not pipeline:
        raise AppError("Selected pipeline was not found", 400)
    stage = db.query(PipelineStage).filter(
        PipelineStage.id == stage_id, PipelineStage.pipelineId == pipeline_id).first()
    if not stage:
        raise AppError("Selected stage does not belong to the chosen pipeline", 400)
