from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


def parse_optional_date(value: Optional[str]) -> Optional[datetime]:
    """Mirrors the toDate() helper used across the Next.js repositories."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class OwnerRef(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class CompanyRef(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True
