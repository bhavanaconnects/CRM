"""Ported from src/validators/company.ts."""
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

PHONE_RE = re.compile(r"^[+()\-.\s\d]{7,30}$")
URL_RE = re.compile(r"^https?://.+", re.I)


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    return v.strip() if isinstance(v, str) else v


class CompanyBase(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    industry: Optional[str] = Field(default=None, max_length=150)
    website: Optional[str] = None
    phone: Optional[str] = None
    ownerId: Optional[str] = None

    @field_validator("website", mode="before")
    @classmethod
    def _url(cls, v):
        v = _blank_to_none(v)
        if v and not URL_RE.match(v):
            raise ValueError("Must be a valid URL starting with http:// or https://")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v):
        v = _blank_to_none(v)
        if v and not PHONE_RE.match(v):
            raise ValueError("Invalid phone number")
        return v

    @field_validator("ownerId", "industry", mode="before")
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)


class CompanyCreate(CompanyBase):
    name: str = Field(min_length=1, max_length=200)


class CompanyUpdate(CompanyBase):
    pass
