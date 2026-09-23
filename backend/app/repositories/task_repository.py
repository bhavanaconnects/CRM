"""Port of src/repositories/task.repository.ts, completed for the Tasks module.

Adds the pieces the original minimal port was missing: description, single
fetch, delete, completion, filtering/search/sorting, dashboard counters and
the per-user My Work buckets.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Task, _utcnow
from app.schemas.common import parse_optional_date

# Everything the Tasks UI renders per row, eager-loaded so the serializer
# never triggers a query per task.
_LIST_OPTS = (
    joinedload(Task.assignee), joinedload(Task.lead),
    joinedload(Task.contact), joinedload(Task.company), joinedload(Task.deal),
)

OPEN_STATUSES = ("PENDING", "IN_PROGRESS")
CLOSED_STATUSES = ("COMPLETED", "CANCELLED")

SORTABLE = {"dueDate", "createdAt", "updatedAt", "title", "priority", "status"}

# Views offered by the Tasks page's quick filters.
VIEWS = ("all", "today", "upcoming", "overdue", "completed")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def day_bounds(reference: Optional[datetime] = None):
    """Start/end of the reference day, matching dashboard_repository."""
    ref = reference or now_utc()
    start = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    end = ref.replace(hour=23, minute=59, second=59, microsecond=999000)
    return start, end


def _apply_view(q, view: Optional[str]):
    if not view or view == "all":
        return q
    now = now_utc()
    start_of_today, end_of_today = day_bounds(now)
    if view == "today":
        return q.filter(
            Task.status.notin_(CLOSED_STATUSES),
            Task.dueDate >= start_of_today, Task.dueDate <= end_of_today,
        )
    if view == "upcoming":
        return q.filter(Task.status.notin_(CLOSED_STATUSES), Task.dueDate > end_of_today)
    if view == "overdue":
        # Due dates are captured with day granularity, so a task is overdue
        # once the day it was due has passed -- not from midnight onwards.
        return q.filter(Task.status.notin_(CLOSED_STATUSES), Task.dueDate < start_of_today)
    if view == "completed":
        return q.filter(Task.status == "COMPLETED")
    return q


def _order_by(sort_by: str, sort_dir: str):
    field = sort_by if sort_by in SORTABLE else "dueDate"
    descending = sort_dir == "desc"
    column = getattr(Task, field)
    ordered = column.desc() if descending else column.asc()
    # NULL due dates always sink to the bottom rather than hiding the
    # actionable, dated tasks behind them.
    if field == "dueDate":
        ordered = ordered.nullslast()
    return [ordered, Task.createdAt.desc()]


def list_tasks(
    db: Session, organization_id: str, page: int = 1, page_size: int = 20,
    status=None, priority=None, assignee_id=None, search=None, view=None,
    due_from=None, due_to=None, lead_id=None, contact_id=None,
    company_id=None, deal_id=None, sort_by="dueDate", sort_dir="asc",
):
    q = db.query(Task).options(*_LIST_OPTS).filter(Task.organizationId == organization_id)

    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if assignee_id:
        q = q.filter(Task.assigneeId == assignee_id)
    if lead_id:
        q = q.filter(Task.leadId == lead_id)
    if contact_id:
        q = q.filter(Task.contactId == contact_id)
    if company_id:
        q = q.filter(Task.companyId == company_id)
    if deal_id:
        q = q.filter(Task.dealId == deal_id)

    q = _apply_view(q, view)

    start = parse_optional_date(due_from)
    if start:
        q = q.filter(Task.dueDate >= start.replace(hour=0, minute=0, second=0, microsecond=0))
    end = parse_optional_date(due_to)
    if end:
        q = q.filter(Task.dueDate <= end.replace(hour=23, minute=59, second=59, microsecond=999000))

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(or_(Task.title.ilike(like), Task.description.ilike(like)))

    total = q.count()
    items = (
        q.order_by(*_order_by(sort_by, sort_dir))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, task_id: str) -> Optional[Task]:
    return (
        db.query(Task).options(*_LIST_OPTS)
        .filter(Task.id == task_id, Task.organizationId == organization_id)
        .first()
    )


def create(db: Session, organization_id: str, data) -> Task:
    status = data.status or "PENDING"
    task = Task(
        organizationId=organization_id,
        title=data.title.strip(),
        description=(data.description or None),
        assigneeId=data.assigneeId or None,
        leadId=data.leadId or None,
        contactId=data.contactId or None,
        companyId=data.companyId or None,
        dealId=data.dealId or None,
        status=status,
        priority=data.priority or "MEDIUM",
        dueDate=parse_optional_date(data.dueDate),
        completedAt=_utcnow() if status == "COMPLETED" else None,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


_UPDATABLE = (
    "title", "description", "assigneeId", "leadId", "contactId",
    "companyId", "dealId", "status", "priority", "dueDate",
)


def update(db: Session, organization_id: str, task_id: str, data) -> Optional[Task]:
    task = db.query(Task).filter(
        Task.id == task_id, Task.organizationId == organization_id).first()
    if not task:
        return None

    fields = data.model_dump(exclude_unset=True)
    for key in _UPDATABLE:
        if key not in fields:
            continue
        value = fields[key]
        if key == "dueDate":
            value = parse_optional_date(value)
        elif key == "title":
            value = value.strip()
        elif key in ("description", "assigneeId", "leadId", "contactId", "companyId", "dealId"):
            value = value or None
        setattr(task, key, value)

    # Keep completedAt consistent with whatever status the caller ended on.
    if "status" in fields:
        if task.status == "COMPLETED" and task.completedAt is None:
            task.completedAt = _utcnow()
        elif task.status != "COMPLETED":
            task.completedAt = None

    db.commit()
    db.refresh(task)
    return task


def set_completed(db: Session, organization_id: str, task_id: str,
                  completed: Optional[bool] = None) -> Optional[Task]:
    """Marks a task complete/incomplete. `completed=None` toggles."""
    task = db.query(Task).filter(
        Task.id == task_id, Task.organizationId == organization_id).first()
    if not task:
        return None

    target = (task.status != "COMPLETED") if completed is None else completed
    if target:
        task.status = "COMPLETED"
        task.completedAt = _utcnow()
    else:
        task.status = "PENDING"
        task.completedAt = None

    db.commit()
    db.refresh(task)
    return task


def delete(db: Session, organization_id: str, task_id: str) -> bool:
    task = db.query(Task).filter(
        Task.id == task_id, Task.organizationId == organization_id).first()
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def _base(db: Session, organization_id: str, assignee_id: Optional[str] = None):
    q = db.query(Task).filter(Task.organizationId == organization_id)
    if assignee_id:
        q = q.filter(Task.assigneeId == assignee_id)
    return q


def get_stats(db: Session, organization_id: str, assignee_id: Optional[str] = None):
    """Counters for the dashboard cards and the Tasks page header."""
    now = now_utc()
    start_of_today, end_of_today = day_bounds(now)

    due_today = _base(db, organization_id, assignee_id).filter(
        Task.status.notin_(CLOSED_STATUSES),
        Task.dueDate >= start_of_today, Task.dueDate <= end_of_today,
    ).count()
    overdue = _base(db, organization_id, assignee_id).filter(
        Task.status.notin_(CLOSED_STATUSES), Task.dueDate < start_of_today,
    ).count()
    open_tasks = _base(db, organization_id, assignee_id).filter(
        Task.status.notin_(CLOSED_STATUSES)).count()
    completed = _base(db, organization_id, assignee_id).filter(
        Task.status == "COMPLETED").count()
    total = _base(db, organization_id, assignee_id).count()

    return {
        "dueToday": due_today, "overdue": overdue,
        "open": open_tasks, "completed": completed, "total": total,
    }


def get_my_work(db: Session, organization_id: str, user_id: str, limit: int = 50):
    """Today / upcoming / overdue / recently completed for one user."""
    now = now_utc()
    start_of_today, end_of_today = day_bounds(now)

    def scoped():
        return (
            db.query(Task).options(*_LIST_OPTS)
            .filter(Task.organizationId == organization_id, Task.assigneeId == user_id)
        )

    today = scoped().filter(
        Task.status.notin_(CLOSED_STATUSES),
        Task.dueDate >= start_of_today, Task.dueDate <= end_of_today,
    ).order_by(Task.dueDate.asc()).limit(limit).all()

    upcoming = scoped().filter(
        Task.status.notin_(CLOSED_STATUSES), Task.dueDate > end_of_today,
    ).order_by(Task.dueDate.asc()).limit(limit).all()

    overdue = scoped().filter(
        Task.status.notin_(CLOSED_STATUSES), Task.dueDate < start_of_today,
    ).order_by(Task.dueDate.asc()).limit(limit).all()

    no_due_date = scoped().filter(
        Task.status.notin_(CLOSED_STATUSES), Task.dueDate.is_(None),
    ).order_by(Task.createdAt.desc()).limit(limit).all()

    recently_completed = scoped().filter(
        Task.status == "COMPLETED",
        Task.completedAt >= now - timedelta(days=14),
    ).order_by(Task.completedAt.desc()).limit(limit).all()

    return {
        "today": today, "upcoming": upcoming, "overdue": overdue,
        "noDueDate": no_due_date, "recentlyCompleted": recently_completed,
    }
