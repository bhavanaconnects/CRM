"""Work module router.

A brand-new, standalone entity -- separate from Tasks and Activities, whose
own routers/services/repositories are untouched. Every route requires an
authenticated session, is scoped to the caller's organization, and returns
the shared {success, data} envelope.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.serializers import work_item_detail, work_item_summary
from app.schemas.work import WorkItemCreate, WorkItemUpdate
from app.services import work_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/work", tags=["work"])


@router.get("")
def list_work_items(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = None,
    priority: str | None = None,
    type: str | None = None,
    assigneeId: str | None = None,
    search: str | None = None,
    dueFrom: str | None = None,
    dueTo: str | None = None,
    leadId: str | None = None,
    contactId: str | None = None,
    companyId: str | None = None,
    dealId: str | None = None,
    sortBy: str = "dueDate",
    sortDir: str = "asc",
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = work_service.list_work_items(
        db, current.organization_id, page=page, page_size=pageSize,
        status=status, priority=priority, type=type, assignee_id=assigneeId,
        search=search, due_from=dueFrom, due_to=dueTo, lead_id=leadId,
        contact_id=contactId, company_id=companyId, deal_id=dealId,
        sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [work_item_summary(w) for w in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_work_item(payload: WorkItemCreate,
                     current: CurrentUser = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    work = work_service.create(db, current.organization_id, payload)
    return created(work_item_detail(work))


@router.get("/{work_id}")
def get_work_item(work_id: str, current: CurrentUser = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    work = work_service.get_by_id(db, current.organization_id, work_id)
    return ok(work_item_detail(work))


@router.put("/{work_id}")
def update_work_item(work_id: str, payload: WorkItemUpdate,
                     current: CurrentUser = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    work = work_service.update(db, current.organization_id, work_id, payload)
    return ok(work_item_detail(work))


@router.delete("/{work_id}")
def delete_work_item(work_id: str, current: CurrentUser = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    work_service.remove(db, current.organization_id, work_id)
    return ok({"deleted": True})
