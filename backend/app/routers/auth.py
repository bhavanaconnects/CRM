"""Ported from src/controllers/auth.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.security import create_session_token, verify_password
from app.config import settings
from app.database import get_db
from app.models.core import Organization, Role, User
from app.schemas.auth import LoginRequest
from app.utils.errors import AppError, ok

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.role), joinedload(User.organization))
        .filter(User.email == payload.email)
        .first()
    )
    if not user or not verify_password(payload.password, user.passwordHash):
        raise AppError("Invalid email or password", 401)

    token = create_session_token(user.id, user.organizationId)
    resp = ok({
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role.name, "organizationId": user.organizationId,
    })
    resp.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/",
        max_age=settings.session_duration_seconds,
    )
    return resp


@router.post("/logout")
def logout():
    resp = ok({"loggedOut": True})
    resp.delete_cookie(settings.session_cookie_name, path="/")
    return resp


@router.get("/me")
def me(current: CurrentUser = Depends(get_current_user)):
    return ok({
        "id": current.id, "name": current.name, "email": current.email,
        "role": current.role_name, "organizationId": current.organization_id,
        "organizationName": current.organization_name,
    })
