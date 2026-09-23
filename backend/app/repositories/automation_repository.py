"""Ported from src/services/automation.service.ts (data access half)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.core import AutomationRule, CalendarEvent, Task


def list_rules(db: Session, organization_id: str, take: int = 20):
    return (
        db.query(AutomationRule)
        .filter(AutomationRule.organizationId == organization_id)
        .order_by(AutomationRule.createdAt.desc())
        .limit(take)
        .all()
    )


def my_work_counts(db: Session, organization_id: str, user_id: str):
    now = datetime.now(timezone.utc)
    open_tasks = db.query(Task).filter(
        Task.organizationId == organization_id,
        Task.assigneeId == user_id,
        Task.status.notin_(["COMPLETED", "CANCELLED"]),
    ).count()

    upcoming_meetings = db.query(CalendarEvent).filter(
        CalendarEvent.organizationId == organization_id,
        CalendarEvent.assignedUserId == user_id,
        CalendarEvent.startAt >= now,
        CalendarEvent.eventType == "MEETING",
    ).count()

    pending_follow_ups = db.query(Task).filter(
        Task.organizationId == organization_id,
        Task.assigneeId == user_id,
        Task.dueDate >= now,
        Task.dueDate <= now + timedelta(days=7),
        Task.status.notin_(["COMPLETED", "CANCELLED"]),
    ).count()

    return {
        "openTasks": open_tasks,
        "upcomingMeetings": upcoming_meetings,
        "pendingFollowUps": pending_follow_ups,
    }
