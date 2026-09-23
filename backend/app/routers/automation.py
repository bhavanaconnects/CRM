"""
Ported from src/controllers/automation.controller.ts.

Note the original endpoint name: GET /api/automation returns the
"My Work" summary (open tasks / upcoming meetings / pending follow-ups)
together with the org's automation rules. The My Work page consumes this.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.serializers import automation_rule
from app.services import automation_service
from app.utils.errors import ok

router = APIRouter(prefix="/api/automation", tags=["automation"])


@router.get("")
def list_automations(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    summary = automation_service.get_my_work_summary(db, current.organization_id, current.id)
    return ok({
        "openTasks": summary["openTasks"],
        "upcomingMeetings": summary["upcomingMeetings"],
        "pendingFollowUps": summary["pendingFollowUps"],
        "rules": [automation_rule(r) for r in summary["rules"]],
    })
