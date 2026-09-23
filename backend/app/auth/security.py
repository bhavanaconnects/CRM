"""
Password hashing + session tokens.

Ported 1:1 from src/lib/auth.ts and src/lib/session.ts:
  - bcrypt, 12 salt rounds -> existing passwordHash values in the
    `users` table remain valid; no password reset needed.
  - JWT HS256, payload {userId, organizationId}, 7-day expiry, signed
    with the SAME SESSION_SECRET env var Prisma app used.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

SALT_ROUNDS = 12


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(SALT_ROUNDS)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_session_token(user_id: str, organization_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "userId": user_id,
        "organizationId": organization_id,
        "iat": now,
        "exp": now + timedelta(seconds=settings.session_duration_seconds),
    }
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


def verify_session_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
    except JWTError:
        return None
    if not isinstance(payload.get("userId"), str) or not isinstance(payload.get("organizationId"), str):
        return None
    return {"userId": payload["userId"], "organizationId": payload["organizationId"]}
