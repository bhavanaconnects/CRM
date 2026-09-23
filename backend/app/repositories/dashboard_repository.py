"""Ported from src/repositories/dashboard.repository.ts."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.core import Activity, Deal, Lead, Pipeline, PipelineStage, Task


def get_kpis(db: Session, organization_id: str):
    total_leads = db.query(Lead).filter(Lead.organizationId == organization_id).count()
    new_leads = db.query(Lead).filter(Lead.organizationId == organization_id, Lead.status == "NEW").count()
    open_deals = db.query(Deal).filter(Deal.organizationId == organization_id, Deal.status == "OPEN").count()
    won_deals = db.query(Deal).filter(Deal.organizationId == organization_id, Deal.status == "WON").count()
    pipeline_value = db.query(func.coalesce(func.sum(Deal.amount), 0)).filter(
        Deal.organizationId == organization_id, Deal.status == "OPEN"
    ).scalar()
    revenue = db.query(func.coalesce(func.sum(Deal.amount), 0)).filter(
        Deal.organizationId == organization_id, Deal.status == "WON"
    ).scalar()
    return {
        "totalLeads": total_leads, "newLeads": new_leads,
        "openDeals": open_deals, "wonDeals": won_deals,
        "pipelineValue": float(pipeline_value or 0), "revenue": float(revenue or 0),
    }


def get_recent_leads(db: Session, organization_id: str, take=5):
    return (
        db.query(Lead)
        .filter(Lead.organizationId == organization_id)
        .order_by(Lead.createdAt.desc())
        .limit(take)
        .all()
    )


def get_recent_activities(db: Session, organization_id: str, take=5):
    """Delegates to activity_repository so the dashboard and the Activities
    page always agree on what "recent" means and load the same relations."""
    from app.repositories import activity_repository

    return activity_repository.list_recent(db, organization_id, limit=take)


def get_upcoming_activities(db: Session, organization_id: str, take=5):
    from app.repositories import activity_repository

    return activity_repository.list_upcoming(db, organization_id, limit=take)


def get_todays_tasks(db: Session, organization_id: str):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=999000)
    return (
        db.query(Task)
        .options(joinedload(Task.assignee))
        .filter(Task.organizationId == organization_id, Task.dueDate >= start, Task.dueDate <= end)
        .order_by(Task.dueDate.asc())
        .all()
    )


def get_task_stats(db: Session, organization_id: str):
    """Tasks module counters surfaced on the dashboard.

    Delegates to task_repository so the dashboard and the Tasks page can
    never disagree about what "overdue" or "due today" means.
    """
    from app.repositories import task_repository

    return task_repository.get_stats(db, organization_id)


def get_pipeline_summary(db: Session, organization_id: str):
    stages = (
        db.query(PipelineStage)
        .join(Pipeline, PipelineStage.pipelineId == Pipeline.id)
        .filter(Pipeline.organizationId == organization_id)
        .order_by(PipelineStage.order.asc())
        .all()
    )
    result = []
    for stage in stages:
        open_deals = [d for d in stage.deals if d.status == "OPEN"] if hasattr(stage, "deals") else db.query(Deal).filter(
            Deal.stageId == stage.id, Deal.status == "OPEN"
        ).all()
        result.append({
            "stageId": stage.id, "stageName": stage.name,
            "dealCount": len(open_deals),
            "totalValue": float(sum(d.amount for d in open_deals)) if open_deals else 0,
        })
    return result


def get_leads_by_source(db: Session, organization_id: str):
    rows = (
        db.query(Lead.source, func.count(Lead.id))
        .filter(Lead.organizationId == organization_id)
        .group_by(Lead.source)
        .all()
    )
    return [{"source": source, "count": count} for source, count in rows]


def get_productivity_snapshot(db: Session, organization_id: str):
    now = datetime.now(timezone.utc)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999000)
    start_of_week = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        end_of_month = now.replace(year=now.year + 1, month=1, day=1) - timedelta(seconds=1)
    else:
        end_of_month = now.replace(month=now.month + 1, day=1) - timedelta(seconds=1)

    tasks_completed = db.query(Task).filter(
        Task.organizationId == organization_id, Task.status == "COMPLETED", Task.updatedAt >= start_of_week
    ).count()
    tasks_pending = db.query(Task).filter(
        Task.organizationId == organization_id, Task.status.notin_(["COMPLETED", "CANCELLED"])
    ).count()
    tasks_overdue = db.query(Task).filter(
        Task.organizationId == organization_id, Task.status.notin_(["COMPLETED", "CANCELLED"]), Task.dueDate < now
    ).count()
    meetings_this_week = db.query(Activity).filter(
        Activity.organizationId == organization_id, Activity.type == "MEETING", Activity.occurredAt >= start_of_week
    ).count()
    follow_ups_due = db.query(Task).filter(
        Task.organizationId == organization_id, Task.dueDate >= start_of_today, Task.dueDate <= end_of_today
    ).count()
    deals_closing = db.query(Deal).filter(
        Deal.organizationId == organization_id, Deal.status == "OPEN",
        Deal.expectedCloseDate >= start_of_month, Deal.expectedCloseDate <= end_of_month,
    ).count()

    return {
        "tasksCompletedThisWeek": tasks_completed, "tasksPending": tasks_pending,
        "tasksOverdue": tasks_overdue, "meetingsThisWeek": meetings_this_week,
        "followUpsDue": follow_ups_due, "dealsClosingThisMonth": deals_closing,
    }
