"""Ported from src/services/user.service.ts."""
from sqlalchemy.orm import Session, joinedload

from app.models.core import User


def list_for_org(db: Session, organization_id: str):
    """Lightweight org-scoped user directory for owner/assignee pickers."""
    return (
        db.query(User).options(joinedload(User.role))
        .filter(User.organizationId == organization_id)
        .order_by(User.name.asc())
        .all()
    )


def exists_for_org(db: Session, organization_id: str, user_id: str) -> bool:
    """Tenant-safe existence check used before assigning a user as owner/assignee."""
    return db.query(User.id).filter(
        User.id == user_id, User.organizationId == organization_id
    ).first() is not None
