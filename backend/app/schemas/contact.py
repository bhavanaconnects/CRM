"""Ported from src/validators/contact.ts."""
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

ContactStatus = Literal["ACTIVE", "INACTIVE", "DO_NOT_CONTACT"]
# Contacts reuse the same source taxonomy as leads (LeadSource).
ContactSource = Literal[
    "WEBSITE", "REFERRAL", "LINKEDIN", "GOOGLE", "ADVERTISEMENT", "COLD_CALL",
    "EMAIL", "EVENT", "EXISTING_CUSTOMER", "OTHER",
]

PHONE_RE = re.compile(r"^[+()\-.\s\d]{7,30}$")
URL_RE = re.compile(r"^https?://.+", re.I)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    return v.strip() if isinstance(v, str) else v


class ContactBase(BaseModel):
    firstName: Optional[str] = Field(default=None, max_length=120)
    lastName: Optional[str] = Field(default=None, max_length=120)
    jobTitle: Optional[str] = Field(default=None, max_length=150)
    email: Optional[str] = None
    phone: Optional[str] = None
    mobilePhone: Optional[str] = None
    companyId: Optional[str] = None
    ownerId: Optional[str] = None
    status: Optional[ContactStatus] = None
    source: Optional[ContactSource] = None
    tags: Optional[List[str]] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=120)
    state: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=120)
    postalCode: Optional[str] = Field(default=None, max_length=20)
    website: Optional[str] = None
    linkedinUrl: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    lastContactedAt: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        v = _blank_to_none(v)
        if v and not EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v

    @field_validator("phone", "mobilePhone", mode="before")
    @classmethod
    def _phone(cls, v):
        v = _blank_to_none(v)
        if v and not PHONE_RE.match(v):
            raise ValueError("Invalid phone number")
        return v

    @field_validator("website", "linkedinUrl", mode="before")
    @classmethod
    def _url(cls, v):
        v = _blank_to_none(v)
        if v and not URL_RE.match(v):
            raise ValueError("Must be a valid URL starting with http:// or https://")
        return v

    @field_validator("companyId", "ownerId", mode="before")
    @classmethod
    def _ids(cls, v):
        return _blank_to_none(v)


class ContactCreate(ContactBase):
    firstName: str = Field(min_length=1, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)


class ContactUpdate(ContactBase):
    pass


class BulkContactAction(BaseModel):
    ids: List[str] = Field(min_length=1)
    action: Literal["delete", "assignOwner", "setStatus"]
    ownerId: Optional[str] = None
    status: Optional[ContactStatus] = None
