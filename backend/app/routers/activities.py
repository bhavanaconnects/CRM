"""Ported from src/controllers/activity.controller.ts, completed for the
Activities module (detail, edit, delete, filters, upcoming).

Every route requires an authenticated session, is scoped to the caller's
organization, and returns the shared {success, data} envelope.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.activity import ActivityCreate, ActivityUpdate
from app.schemas.serializers import activity_detail, activity_summary
from app.services import activity_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
def list_activities(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    type: str | None = None,
    status: str | None = None,
    userId: str | None = None,
    search: str | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    leadId: str | None = None,
    contactId: str | None = None,
    companyId: str | None = None,
    dealId: str | None = None,
    sortBy: str = "occurredAt",
    sortDir: str = "desc",
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = activity_service.list_activities(
        db, current.organization_id, page=page, page_size=pageSize,
        type=type, status=status, user_id=userId, search=search,
        date_from=dateFrom, date_to=dateTo, lead_id=leadId,
        contact_id=contactId, company_id=companyId, deal_id=dealId,
        sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [activity_summary(a) for a in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_activity(payload: ActivityCreate,
                    current: CurrentUser = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    activity = activity_service.create(db, current.organization_id, current.id, payload)
    return created(activity_detail(activity))


# Static path declared before /{activity_id} so it isn't swallowed by the
# dynamic route.
@router.get("/upcoming")
def upcoming_activities(
    mine: bool = False,
    userId: str | None = None,
    limit: int = Query(10, ge=1, le=50),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = current.id if mine else userId
    items = activity_service.list_upcoming(db, current.organization_id, user, limit)
    return ok({"items": [activity_summary(a) for a in items]})


@router.get("/{activity_id}")
def get_activity(activity_id: str, current: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    activity = activity_service.get_by_id(db, current.organization_id, activity_id)
    return ok(activity_detail(activity))


@router.put("/{activity_id}")
def update_activity(activity_id: str, payload: ActivityUpdate,
                    current: CurrentUser = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    activity = activity_service.update(db, current.organization_id, activity_id, payload)
    return ok(activity_detail(activity))


@router.delete("/{activity_id}")
def delete_activity(activity_id: str, current: CurrentUser = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    activity_service.remove(db, current.organization_id, activity_id)
    return ok({"deleted": True})
