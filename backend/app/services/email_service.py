"""
Ported from src/services/email.service.ts.

Keeps the same pluggable-provider shape as the original, with the same
MockEmailProvider default, and the same side effect: a successful send
also writes an EMAIL Activity row linked to the related CRM records.
"""
import random
import string
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.core import Activity, Email
from app.repositories import email_repository
from app.utils.errors import AppError


class MockEmailProvider:
    name = "Mock"

    def send(self, payload: dict):
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
        return {"ok": True, "messageId": f"mock-{int(time.time() * 1000)}-{suffix}"}


provider = MockEmailProvider()


def list_emails(db: Session, organization_id: str):
    return email_repository.list_emails(db, organization_id)


def get_by_id(db: Session, organization_id: str, email_id: str):
    email = email_repository.find_by_id(db, organization_id, email_id)
    if not email:
        raise AppError("Email not found", 404)
    return email


def send(db: Session, organization_id: str, user_id, data):
    result = provider.send(data.model_dump())

    email = Email(
        organizationId=organization_id,
        userId=user_id,
        provider="MOCK",
        fromName=data.fromName or "CRM",
        fromEmail=data.fromEmail or "noreply@example.com",
        replyTo=data.replyTo,
        to=data.to,
        cc=data.cc,
        bcc=data.bcc,
        subject=data.subject,
        body=data.body,
        relatedLeadId=data.relatedLeadId,
        relatedContactId=data.relatedContactId,
        relatedCompanyId=data.relatedCompanyId,
        relatedDealId=data.relatedDealId,
        status="SENT" if result["ok"] else "FAILED",
        sentAt=datetime.now(timezone.utc) if result["ok"] else None,
    )
    db.add(email)
    db.commit()
    db.refresh(email)

    if not result["ok"]:
        raise AppError(result.get("error", "Email send failed"), 400)

    activity = Activity(
        organizationId=organization_id,
        userId=user_id,
        leadId=data.relatedLeadId,
        contactId=data.relatedContactId,
        companyId=data.relatedCompanyId,
        dealId=data.relatedDealId,
        type="EMAIL",
        notes=f"Email sent to {data.to}: {data.subject}",
        occurredAt=datetime.now(timezone.utc),
    )
    db.add(activity)
    db.commit()

    return email
