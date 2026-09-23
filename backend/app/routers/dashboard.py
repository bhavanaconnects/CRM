"""Ported from src/controllers/dashboard.controller.ts + dashboard.service.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.repositories import dashboard_repository as repo
from app.schemas.serializers import activity_summary, iso, num, user_ref
from app.utils.errors import ok

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    org = current.organization_id

    recent_leads = [
        {
            "id": l.id, "firstName": l.firstName, "lastName": l.lastName,
            "companyName": l.companyName, "status": l.status, "source": l.source,
            "createdAt": iso(l.createdAt),
        }
        for l in repo.get_recent_leads(db, org)
    ]

    recent_activities = [activity_summary(a) for a in repo.get_recent_activities(db, org)]
    upcoming_activities = [activity_summary(a) for a in repo.get_upcoming_activities(db, org)]

    todays_tasks = [
        {"id": t.id, "title": t.title, "priority": t.priority, "status": t.status, "assignee": user_ref(t.assignee)}
        for t in repo.get_todays_tasks(db, org)
    ]

    return ok({
        "kpis": repo.get_kpis(db, org),
        "recentLeads": recent_leads,
        "recentActivities": recent_activities,
        "upcomingActivities": upcoming_activities,
        "todaysTasks": todays_tasks,
        "taskStats": repo.get_task_stats(db, org),
        "pipeline": repo.get_pipeline_summary(db, org),
        "leadsBySource": repo.get_leads_by_source(db, org),
        "productivity": repo.get_productivity_snapshot(db, org),
    })
