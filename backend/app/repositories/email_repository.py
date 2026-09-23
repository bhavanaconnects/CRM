"""Ported from src/services/email.service.ts (data access half)."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.core import Email


def list_emails(db: Session, organization_id: str, take: int = 30):
    return (
        db.query(Email)
        .filter(Email.organizationId == organization_id)
        .order_by(Email.createdAt.desc())
        .limit(take)
        .all()
    )


def find_by_id(db: Session, organization_id: str, email_id: str) -> Optional[Email]:
    return db.query(Email).filter(
        Email.id == email_id, Email.organizationId == organization_id
    ).first()
