"""Ported from src/services/automation.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import automation_repository


def list_rules(db: Session, organization_id: str):
    return automation_repository.list_rules(db, organization_id)


def get_my_work_summary(db: Session, organization_id: str, user_id: str):
    counts = automation_repository.my_work_counts(db, organization_id, user_id)
    return {**counts, "rules": automation_repository.list_rules(db, organization_id)}
