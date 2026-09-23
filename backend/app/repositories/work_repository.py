"""Work module repository: full CRUD plus filtering, search and sorting.

WorkItem is a brand-new, standalone table -- this file has no dependency on
task_repository.py or activity_repository.py, and neither of those files is
touched by the Work module.
"""
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import WorkItem
from app.schemas.common import parse_optional_date

# Everything the Work list renders per row, eager-loaded so the serializer
# never triggers a query per work item.
_LIST_OPTS = (
    joinedload(WorkItem.assignee), joinedload(WorkItem.lead),
    joinedload(WorkItem.contact), joinedload(WorkItem.company),
    joinedload(WorkItem.deal),
)

SORTABLE = {"dueDate", "createdAt", "updatedAt", "title", "priority", "status", "type"}


def list_work_items(
    db: Session, organization_id: str, page: int = 1, page_size: int = 20,
    status=None, priority=None, type=None, assignee_id=None, search=None,
    due_from=None, due_to=None, lead_id=None, contact_id=None,
    company_id=None, deal_id=None, sort_by="dueDate", sort_dir="asc",
):
    q = db.query(WorkItem).options(*_LIST_OPTS).filter(
        WorkItem.organizationId == organization_id)

    if status:
        q = q.filter(WorkItem.status == status)
    if priority:
        q = q.filter(WorkItem.priority == priority)
    if type:
        q = q.filter(WorkItem.type == type)
    if assignee_id:
        q = q.filter(WorkItem.assigneeId == assignee_id)
    if lead_id:
        q = q.filter(WorkItem.leadId == lead_id)
    if contact_id:
        q = q.filter(WorkItem.contactId == contact_id)
    if company_id:
        q = q.filter(WorkItem.companyId == company_id)
    if deal_id:
        q = q.filter(WorkItem.dealId == deal_id)

    start = parse_optional_date(due_from)
    if start:
        q = q.filter(WorkItem.dueDate >= start.replace(hour=0, minute=0, second=0, microsecond=0))
    end = parse_optional_date(due_to)
    if end:
        q = q.filter(WorkItem.dueDate <= end.replace(hour=23, minute=59, second=59, microsecond=999000))

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(or_(WorkItem.title.ilike(like), WorkItem.description.ilike(like)))

    total = q.count()

    field = sort_by if sort_by in SORTABLE else "dueDate"
    column = getattr(WorkItem, field)
    ordered = column.desc() if sort_dir == "desc" else column.asc()
    if field == "dueDate":
        # NULL due dates sink to the bottom rather than hiding dated,
        # actionable items behind them.
        ordered = ordered.nullslast()

    items = (
        q.order_by(ordered, WorkItem.createdAt.desc())
        .offset((page - 1) * page_size).limit(page_size).all()
    )
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, work_id: str) -> Optional[WorkItem]:
    return (
        db.query(WorkItem).options(*_LIST_OPTS)
        .filter(WorkItem.id == work_id, WorkItem.organizationId == organization_id)
        .first()
    )


def create(db: Session, organization_id: str, data) -> WorkItem:
    work = WorkItem(
        organizationId=organization_id,
        title=data.title.strip(),
        description=(data.description or None),
        type=data.type or "TASK",
        priority=data.priority or "MEDIUM",
        status=data.status or "OPEN",
        assigneeId=data.assigneeId or None,
        leadId=data.leadId or None,
        contactId=data.contactId or None,
        companyId=data.companyId or None,
        dealId=data.dealId or None,
        dueDate=parse_optional_date(data.dueDate),
    )
    db.add(work)
    db.commit()
    db.refresh(work)
    return work


_UPDATABLE = (
    "title", "description", "type", "priority", "status", "assigneeId",
    "leadId", "contactId", "companyId", "dealId", "dueDate",
)
_NULLABLE_FKS = ("assigneeId", "leadId", "contactId", "companyId", "dealId")


def update(db: Session, organization_id: str, work_id: str, data) -> Optional[WorkItem]:
    work = db.query(WorkItem).filter(
        WorkItem.id == work_id, WorkItem.organizationId == organization_id).first()
    if not work:
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
        elif key in _NULLABLE_FKS:
            value = value or None
        setattr(work, key, value)

    db.commit()
    db.refresh(work)
    return work


def delete(db: Session, organization_id: str, work_id: str) -> bool:
    work = db.query(WorkItem).filter(
        WorkItem.id == work_id, WorkItem.organizationId == organization_id).first()
    if not work:
        return False
    db.delete(work)
    db.commit()
    return True
