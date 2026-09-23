"""Ported from src/controllers/user.controller.ts + src/services/user.service.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.repositories import user_repository
from app.utils.errors import ok

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    users = user_repository.list_for_org(db, current.organization_id)
    return ok([
        {"id": u.id, "name": u.name, "email": u.email,
         "role": {"name": u.role.name} if u.role else None}
        for u in users
    ])
