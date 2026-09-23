"""Ported from the inline zod schema in src/controllers/email.controller.ts."""
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    return v.strip() if isinstance(v, str) else v


class SendEmailRequest(BaseModel):
    to: str = Field(min_length=1)
    cc: Optional[str] = None
    bcc: Optional[str] = None
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    fromName: Optional[str] = Field(default=None, max_length=200)
    fromEmail: Optional[str] = None
    replyTo: Optional[str] = None
    relatedLeadId: Optional[str] = None
    relatedContactId: Optional[str] = None
    relatedCompanyId: Optional[str] = None
    relatedDealId: Optional[str] = None

    @field_validator("fromEmail", "replyTo", mode="before")
    @classmethod
    def _email(cls, v):
        v = _blank_to_none(v)
        if v and not EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v

    @field_validator("cc", "bcc", "fromName", "relatedLeadId", "relatedContactId",
                     "relatedCompanyId", "relatedDealId", mode="before")
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)
