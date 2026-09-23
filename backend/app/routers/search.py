"""Ported from src/controllers/search.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.serializers import search_results
from app.services import search_service
from app.utils.errors import AppError, ok

router = APIRouter(prefix="/api/search", tags=["search"])

EMPTY = {"leads": [], "contacts": [], "companies": [], "deals": [], "tasks": [], "activities": []}


@router.get("")
def search(q: str = "", current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    query = (q or "").strip()
    if not query:
        return ok(dict(EMPTY))
    if len(query) > 200:
        raise AppError("Search term is too long", 400)
    return ok(search_results(search_service.search(db, current.organization_id, query)))
