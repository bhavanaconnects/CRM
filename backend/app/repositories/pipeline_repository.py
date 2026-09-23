"""Ported from src/repositories/pipeline.repository.ts."""
from sqlalchemy.orm import Session, joinedload

from app.models.core import Pipeline


def list_for_org(db: Session, organization_id: str):
    return (
        db.query(Pipeline)
        .options(joinedload(Pipeline.stages))
        .filter(Pipeline.organizationId == organization_id)
        .order_by(Pipeline.createdAt.asc())
        .all()
    )


def find_default_for_org(db: Session, organization_id: str):
    return (
        db.query(Pipeline)
        .options(joinedload(Pipeline.stages))
        .filter(Pipeline.organizationId == organization_id)
        .order_by(Pipeline.createdAt.asc())
        .first()
    )
