"""
FastAPI dependency mirroring src/lib/auth.ts#requireCurrentUser.

Reads the same `crm_session` cookie, verifies it the same way, and loads
the current user + role + organization. Raises 401 (as AppError) if
missing/invalid -- same behavior as the Next.js UnauthorizedError.
"""
from fastapi import Cookie, Depends, Request
from sqlalchemy.orm import Session

from app.auth.security import verify_session_token
from app.config import settings
from app.database import get_db
from app.models.core import Organization, Role, User
from app.utils.errors import AppError


class CurrentUser:
    def __init__(self, user: User, role: Role, organization: Organization):
        self.id = user.id
        self.name = user.name
        self.email = user.email
        self.organization_id = user.organizationId
        self.role_name = role.name
        self.organization_name = organization.name


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> CurrentUser:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise AppError("Not authenticated", 401)

    session = verify_session_token(token)
    if not session:
        raise AppError("Not authenticated", 401)

    user = db.query(User).filter(User.id == session["userId"]).first()
    if not user or user.organizationId != session["organizationId"]:
        raise AppError("Not authenticated", 401)

    role = db.query(Role).filter(Role.id == user.roleId).first()
    organization = db.query(Organization).filter(Organization.id == user.organizationId).first()

    return CurrentUser(user, role, organization)
