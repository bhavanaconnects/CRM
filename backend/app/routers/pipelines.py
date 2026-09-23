"""Ported from src/controllers/pipeline.controller.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db
from app.repositories import pipeline_repository
from app.schemas.serializers import pipeline_with_stages
from app.utils.errors import ok

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("")
def list_pipelines(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    pipelines = pipeline_repository.list_for_org(db, current.organization_id)
    return ok([pipeline_with_stages(p) for p in pipelines])
