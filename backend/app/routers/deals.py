"""Ported from src/controllers/deal.controller.ts + src/app/api/deals/**."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.deal import ChangeDealStage, DealCreate, DealUpdate
from app.schemas.serializers import deal_detail, deal_summary
from app.services import deal_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("")
def list_deals(
    page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100),
    status: str | None = None, stageId: str | None = None, pipelineId: str | None = None,
    ownerId: str | None = None, companyId: str | None = None, contactId: str | None = None,
    search: str | None = None, sortBy: str = "createdAt", sortDir: str = "desc",
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    result = deal_service.list_deals(
        db, current.organization_id, page=page, page_size=pageSize, status=status,
        stage_id=stageId, pipeline_id=pipelineId, owner_id=ownerId, company_id=companyId,
        contact_id=contactId, search=search, sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [deal_summary(d) for d in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.get("/board")
def deals_board(
    pipelineId: str | None = None, ownerId: str | None = None,
    companyId: str | None = None, search: str | None = None,
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    deals = deal_service.board(
        db, current.organization_id, pipeline_id=pipelineId, owner_id=ownerId,
        company_id=companyId, search=search,
    )
    return ok([deal_summary(d) for d in deals])


@router.post("")
def create_deal(payload: DealCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    deal = deal_service.create(db, current.organization_id, payload)
    return created(deal_summary(deal))


@router.get("/{deal_id}")
def get_deal(deal_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    deal = deal_service.get_by_id(db, current.organization_id, deal_id)
    return ok(deal_detail(deal))


@router.put("/{deal_id}")
def update_deal(deal_id: str, payload: DealUpdate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    deal = deal_service.update(db, current.organization_id, deal_id, payload)
    return ok(deal_summary(deal))


# The original Next.js route exported PATCH for this endpoint
# (src/app/api/deals/[id]/stage/route.ts). PUT is also accepted because the
# migration spec and the kanban frontend use it; both behave identically.
@router.api_route("/{deal_id}/stage", methods=["PATCH", "PUT"])
def change_stage(deal_id: str, payload: ChangeDealStage, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    deal = deal_service.change_stage(db, current.organization_id, deal_id, payload)
    return ok(deal_summary(deal))


@router.delete("/{deal_id}")
def delete_deal(deal_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    deal_service.remove(db, current.organization_id, deal_id)
    return ok({"deleted": True})
