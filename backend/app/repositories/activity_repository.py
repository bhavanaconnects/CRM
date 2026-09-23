"""Port of src/repositories/activity.repository.ts, completed for the
Activities module: single fetch, update, delete, filtering/search/sorting and
the per-user upcoming list.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.core import Activity
from app.schemas.activity import DURATION_TYPES
from app.schemas.common import parse_optional_date

# Everything the timeline renders per row, eager-loaded so the serializer
# never triggers a query per activity.
_LIST_OPTS = (
    joinedload(Activity.user), joinedload(Activity.lead),
    joinedload(Activity.contact), joinedload(Activity.company),
    joinedload(Activity.deal),
)

SORTABLE = {"occurredAt", "createdAt", "type", "status", "subject"}

TYPE_LABELS = {
    "CALL": "Call", "MEETING": "Meeting", "EMAIL": "Email",
    "NOTE": "Note", "WHATSAPP": "WhatsApp", "FOLLOW_UP": "Follow up",
}


def _now():
    return datetime.now(timezone.utc)


def _default_subject(activity_type: str) -> str:
    return TYPE_LABELS.get(activity_type, "Activity")


def _clean_duration(activity_type, duration):
    """Duration is only meaningful for calls and meetings."""
    if activity_type in DURATION_TYPES:
        return duration
    return None


def list_activities(
    db: Session, organization_id: str, page: int = 1, page_size: int = 20,
    type=None, status=None, user_id=None, search=None,
    date_from=None, date_to=None, lead_id=None, contact_id=None,
    company_id=None, deal_id=None, sort_by="occurredAt", sort_dir="desc",
):
    q = db.query(Activity).options(*_LIST_OPTS).filter(
        Activity.organizationId == organization_id)

    if type:
        q = q.filter(Activity.type == type)
    if status:
        q = q.filter(Activity.status == status)
    if user_id:
        q = q.filter(Activity.userId == user_id)
    if lead_id:
        q = q.filter(Activity.leadId == lead_id)
    if contact_id:
        q = q.filter(Activity.contactId == contact_id)
    if company_id:
        q = q.filter(Activity.companyId == company_id)
    if deal_id:
        q = q.filter(Activity.dealId == deal_id)

    start = parse_optional_date(date_from)
    if start:
        q = q.filter(Activity.occurredAt >= start.replace(
            hour=0, minute=0, second=0, microsecond=0))
    end = parse_optional_date(date_to)
    if end:
        q = q.filter(Activity.occurredAt <= end.replace(
            hour=23, minute=59, second=59, microsecond=999000))

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(or_(Activity.subject.ilike(like), Activity.notes.ilike(like)))

    total = q.count()

    field = sort_by if sort_by in SORTABLE else "occurredAt"
    column = getattr(Activity, field)
    ordered = column.desc() if sort_dir == "desc" else column.asc()

    items = (
        q.order_by(ordered, Activity.createdAt.desc())
        .offset((page - 1) * page_size).limit(page_size).all()
    )
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


def find_by_id(db: Session, organization_id: str, activity_id: str) -> Optional[Activity]:
    return (
        db.query(Activity).options(*_LIST_OPTS)
        .filter(Activity.id == activity_id, Activity.organizationId == organization_id)
        .first()
    )


def create(db: Session, organization_id: str, user_id: str, data) -> Activity:
    occurred_at = parse_optional_date(data.occurredAt) or _now()
    # An activity dated in the future is planned unless told otherwise.
    default_status = "PLANNED" if occurred_at.replace(tzinfo=None) > _now().replace(tzinfo=None) else "COMPLETED"
    activity = Activity(
        organizationId=organization_id,
        # `userId` is the assigned user; it defaults to whoever logged it.
        userId=(getattr(data, "userId", None) or user_id),
        type=data.type,
        subject=(data.subject or _default_subject(data.type)),
        notes=data.notes,
        status=data.status or default_status,
        durationMinutes=_clean_duration(data.type, data.durationMinutes),
        leadId=data.leadId or None,
        contactId=data.contactId or None,
        companyId=data.companyId or None,
        dealId=data.dealId or None,
        occurredAt=occurred_at,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


_UPDATABLE = (
    "type", "subject", "notes", "status", "durationMinutes", "userId",
    "leadId", "contactId", "companyId", "dealId", "occurredAt",
)

_NULLABLE_FKS = ("leadId", "contactId", "companyId", "dealId")


def update(db: Session, organization_id: str, activity_id: str, data) -> Optional[Activity]:
    activity = db.query(Activity).filter(
        Activity.id == activity_id, Activity.organizationId == organization_id).first()
    if not activity:
        return None

    fields = data.model_dump(exclude_unset=True)
    for key in _UPDATABLE:
        if key not in fields:
            continue
        value = fields[key]
        if key == "occurredAt":
            value = parse_optional_date(value) or activity.occurredAt
        elif key in _NULLABLE_FKS:
            value = value or None
        elif key in ("type", "status", "notes", "userId") and value is None:
            # Never null out a NOT NULL column from a partial update.
            continue
        elif key == "subject" and not value:
            value = _default_subject(fields.get("type") or activity.type)
        setattr(activity, key, value)

    activity.durationMinutes = _clean_duration(activity.type, activity.durationMinutes)

    db.commit()
    db.refresh(activity)
    return activity


def delete(db: Session, organization_id: str, activity_id: str) -> bool:
    activity = db.query(Activity).filter(
        Activity.id == activity_id, Activity.organizationId == organization_id).first()
    if not activity:
        return False
    db.delete(activity)
    db.commit()
    return True


def list_upcoming(db: Session, organization_id: str, user_id: Optional[str] = None,
                  limit: int = 10):
    """Planned activities dated from now on, soonest first."""
    q = db.query(Activity).options(*_LIST_OPTS).filter(
        Activity.organizationId == organization_id,
        Activity.status == "PLANNED",
        Activity.occurredAt >= _now(),
    )
    if user_id:
        q = q.filter(Activity.userId == user_id)
    return q.order_by(Activity.occurredAt.asc()).limit(limit).all()


def list_recent(db: Session, organization_id: str, user_id: Optional[str] = None,
                limit: int = 10):
    """Most recently occurred activities, newest first."""
    q = db.query(Activity).options(*_LIST_OPTS).filter(
        Activity.organizationId == organization_id,
        Activity.occurredAt <= _now(),
    )
    if user_id:
        q = q.filter(Activity.userId == user_id)
    return q.order_by(Activity.occurredAt.desc()).limit(limit).all()
