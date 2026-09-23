"""Ported from src/controllers/email.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.email import SendEmailRequest
from app.schemas.serializers import email_summary
from app.services import email_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/email", tags=["email"])


@router.get("")
def list_emails(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok([email_summary(e) for e in email_service.list_emails(db, current.organization_id)])


@router.post("/send")
def send_email(payload: SendEmailRequest, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    email = email_service.send(db, current.organization_id, current.id, payload)
    return created(email_summary(email))


@router.get("/{email_id}")
def get_email(email_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(email_summary(email_service.get_by_id(db, current.organization_id, email_id)))
