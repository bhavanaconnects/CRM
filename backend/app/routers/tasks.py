"""Ported from src/controllers/task.controller.ts + src/app/api/tasks/**,
completed for the Tasks module (detail, delete, completion, filters, stats).

Every route requires an authenticated session and is scoped to the caller's
organization, and every response uses the shared {success, data} envelope.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.serializers import task_detail, task_summary
from app.schemas.task import TaskCompleteRequest, TaskCreate, TaskUpdate
from app.services import task_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
def list_tasks(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = None,
    priority: str | None = None,
    assigneeId: str | None = None,
    search: str | None = None,
    view: str | None = Query(None, description="all | today | upcoming | overdue | completed"),
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
    result = task_service.list_tasks(
        db, current.organization_id, page=page, page_size=pageSize,
        status=status, priority=priority, assignee_id=assigneeId,
        search=search, view=view, due_from=dueFrom, due_to=dueTo,
        lead_id=leadId, contact_id=contactId, company_id=companyId,
        deal_id=dealId, sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [task_summary(t) for t in result["items"]],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_task(payload: TaskCreate, current: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    task = task_service.create(db, current.organization_id, payload)
    return created(task_detail(task))


# --- Static paths must be declared before /{task_id} so they aren't
# --- swallowed by the dynamic route.


@router.get("/stats")
def task_stats(
    assigneeId: str | None = None,
    mine: bool = False,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignee = current.id if mine else assigneeId
    return ok(task_service.get_stats(db, current.organization_id, assignee))


@router.get("/my-work")
def my_work(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    buckets = task_service.get_my_work(db, current.organization_id, current.id)
    return ok({
        "today": [task_summary(t) for t in buckets["today"]],
        "upcoming": [task_summary(t) for t in buckets["upcoming"]],
        "overdue": [task_summary(t) for t in buckets["overdue"]],
        "noDueDate": [task_summary(t) for t in buckets["noDueDate"]],
        "recentlyCompleted": [task_summary(t) for t in buckets["recentlyCompleted"]],
        "stats": task_service.get_stats(db, current.organization_id, current.id),
    })


@router.get("/{task_id}")
def get_task(task_id: str, current: CurrentUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    task = task_service.get_by_id(db, current.organization_id, task_id)
    return ok(task_detail(task))


@router.put("/{task_id}")
def update_task(task_id: str, payload: TaskUpdate,
                current: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    task = task_service.update(db, current.organization_id, task_id, payload)
    return ok(task_detail(task))


@router.patch("/{task_id}/complete")
def complete_task(task_id: str, payload: TaskCompleteRequest | None = None,
                  current: CurrentUser = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    completed = payload.completed if payload else None
    task = task_service.set_completed(db, current.organization_id, task_id, completed)
    return ok(task_detail(task))


@router.delete("/{task_id}")
def delete_task(task_id: str, current: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    task_service.remove(db, current.organization_id, task_id)
    return ok({"deleted": True})
