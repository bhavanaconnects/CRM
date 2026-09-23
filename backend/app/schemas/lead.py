from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

LeadStatus = Literal["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "CONVERTED", "UNQUALIFIED", "LOST"]
LeadSource = Literal[
    "WEBSITE", "REFERRAL", "LINKEDIN", "GOOGLE", "ADVERTISEMENT", "COLD_CALL",
    "EMAIL", "EVENT", "EXISTING_CUSTOMER", "OTHER",
]
LeadPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class LeadCreate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    email: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    companyName: Optional[str] = Field(default=None, max_length=200)
    companyId: Optional[str] = None
    jobTitle: Optional[str] = Field(default=None, max_length=150)
    source: Optional[LeadSource] = None
    status: Optional[LeadStatus] = None
    priority: Optional[LeadPriority] = None
    ownerId: Optional[str] = None
    estimatedValue: Optional[Decimal] = Field(default=None, ge=0)
    expectedCloseDate: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    tags: Optional[List[str]] = Field(default=None, max_length=20)

    @field_validator("email")
    @classmethod
    def empty_email_ok(cls, v):
        if v in (None, ""):
            return None
        return v


class LeadUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    companyName: Optional[str] = None
    companyId: Optional[str] = None
    jobTitle: Optional[str] = None
    source: Optional[LeadSource] = None
    status: Optional[LeadStatus] = None
    priority: Optional[LeadPriority] = None
    ownerId: Optional[str] = None
    estimatedValue: Optional[Decimal] = None
    expectedCloseDate: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class BulkLeadAction(BaseModel):
    ids: List[str] = Field(min_length=1)
    action: Literal["delete", "assignOwner", "setStatus"]
    ownerId: Optional[str] = None
    status: Optional[LeadStatus] = None


class ConvertCompanyInput(BaseModel):
    mode: Literal["existing", "new", "none"] = "new"
    companyId: Optional[str] = None
    name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None


class ConvertContactInput(BaseModel):
    mode: Literal["existing", "new", "none"] = "new"
    contactId: Optional[str] = None


class ConvertDealInput(BaseModel):
    create: bool = True
    title: Optional[str] = None
    amount: Optional[Decimal] = None
    pipelineId: Optional[str] = None
    stageId: Optional[str] = None


class LeadConvertRequest(BaseModel):
    company: Optional[ConvertCompanyInput] = None
    contact: Optional[ConvertContactInput] = None
    deal: Optional[ConvertDealInput] = None
