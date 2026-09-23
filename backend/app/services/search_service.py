"""Ported from src/services/search.service.ts."""
from sqlalchemy.orm import Session

from app.repositories import search_repository

EMPTY = {"leads": [], "contacts": [], "companies": [], "deals": [], "tasks": [], "activities": []}


def search(db: Session, organization_id: str, query: str):
    q = (query or "").strip()
    if not q:
        return dict(EMPTY)
    return search_repository.search_all(db, organization_id, q)
