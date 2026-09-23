"""Ported from src/controllers/lead.controller.ts + src/app/api/leads/**."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.lead import BulkLeadAction, LeadConvertRequest, LeadCreate, LeadUpdate
from app.schemas.serializers import lead_detail, lead_summary
from app.services import lead_service
from app.utils.errors import ok, created

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.get("")
def list_leads(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = None,
    source: str | None = None,
    priority: str | None = None,
    ownerId: str | None = None,
    search: str | None = None,
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = lead_service.list_leads(
        db, current.organization_id, page=page, page_size=pageSize,
        status=status, source=source, priority=priority, owner_id=ownerId,
        search=search, sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [lead_summary(l) for l in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_lead(payload: LeadCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = lead_service.create(db, current.organization_id, current.id, payload)
    return created(lead_summary(lead))


@router.get("/{lead_id}")
def get_lead(lead_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = lead_service.get_by_id(db, current.organization_id, lead_id)
    return ok(lead_detail(lead))


@router.put("/{lead_id}")
def update_lead(lead_id: str, payload: LeadUpdate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = lead_service.update(db, current.organization_id, lead_id, payload)
    return ok(lead_summary(lead))


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    lead_service.remove(db, current.organization_id, lead_id)
    return ok({"deleted": True})


@router.post("/bulk")
def bulk_action(payload: BulkLeadAction, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(lead_service.bulk_action(db, current.organization_id, payload))


@router.post("/{lead_id}/convert")
def convert_lead(lead_id: str, payload: LeadConvertRequest, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    result = lead_service.convert(db, current.organization_id, current.id, lead_id, payload)
    return ok({
        "lead": lead_summary(result["lead"]),
        "companyId": result["companyId"], "contactId": result["contactId"], "dealId": result["dealId"],
    })
