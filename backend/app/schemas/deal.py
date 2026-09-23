"""Ported from src/validators/deal.ts."""
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

DealStatus = Literal["OPEN", "WON", "LOST"]


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    return v.strip() if isinstance(v, str) else v


class DealBase(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    amount: Optional[Decimal] = Field(default=None, ge=0)
    probability: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[DealStatus] = None
    pipelineId: Optional[str] = None
    stageId: Optional[str] = None
    ownerId: Optional[str] = None
    companyId: Optional[str] = None
    contactId: Optional[str] = None
    expectedCloseDate: Optional[str] = None

    @field_validator("ownerId", "companyId", "contactId", "expectedCloseDate", mode="before")
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)


class DealCreate(DealBase):
    title: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(ge=0)
    pipelineId: str
    stageId: str


class DealUpdate(DealBase):
    pass


class ChangeDealStage(BaseModel):
    stageId: str
    status: Optional[DealStatus] = None
