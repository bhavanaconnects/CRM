"""
Ported from src/services/deal.service.ts, including the owner
notifications fired on stage change / won / lost. As in the original,
notification failures are swallowed so they never block a deal update.
"""
from types import SimpleNamespace

from sqlalchemy.orm import Session

from app.repositories import deal_repository
from app.services import notification_service
from app.services.guards import (
    assert_company_in_org, assert_contact_in_org, assert_owner_in_org, assert_stage_in_pipeline,
)
from app.utils.errors import NotFoundError


def _notify_deal_change(db: Session, organization_id: str, deal, *, stage_changed, won_now, lost_now):
    if not deal.ownerId:
        return
    try:
        if won_now:
            payload = SimpleNamespace(
                userId=deal.ownerId, type="DEAL_WON", title="Deal won",
                message="A deal you own moved to Won.",
                relatedEntity="deal", relatedEntityId=deal.id)
        elif lost_now:
            payload = SimpleNamespace(
                userId=deal.ownerId, type="DEAL_LOST", title="Deal lost",
                message="A deal you own moved to Lost.",
                relatedEntity="deal", relatedEntityId=deal.id)
        elif stage_changed:
            stage_name = deal.stage.name if deal.stage else "a new"
            payload = SimpleNamespace(
                userId=deal.ownerId, type="DEAL_STAGE_CHANGED", title="Deal stage changed",
                message=f'A deal you own moved to the "{stage_name}" stage.',
                relatedEntity="deal", relatedEntityId=deal.id)
        else:
            return
        notification_service.create(db, organization_id, payload)
    except Exception:
        # Notification failures should never block the underlying deal update.
        db.rollback()


def list_deals(db: Session, organization_id: str, **query):
    return deal_repository.list_deals(db, organization_id, **query)


def board(db: Session, organization_id: str, **query):
    return deal_repository.board(db, organization_id, **query)


def get_by_id(db: Session, organization_id: str, deal_id: str):
    deal = deal_repository.find_by_id(db, organization_id, deal_id)
    if not deal:
        raise NotFoundError("Deal")
    return deal


def create(db: Session, organization_id: str, data):
    assert_stage_in_pipeline(db, organization_id, data.pipelineId, data.stageId)
    assert_owner_in_org(db, organization_id, data.ownerId)
    assert_company_in_org(db, organization_id, data.companyId)
    assert_contact_in_org(db, organization_id, data.contactId)
    return deal_repository.create(db, organization_id, data)


def update(db: Session, organization_id: str, deal_id: str, data):
    existing = deal_repository.find_by_id(db, organization_id, deal_id)
    if not existing:
        raise NotFoundError("Deal")

    if data.pipelineId and data.stageId:
        assert_stage_in_pipeline(db, organization_id, data.pipelineId, data.stageId)
    elif data.stageId and not data.pipelineId:
        assert_stage_in_pipeline(db, organization_id, existing.pipelineId, data.stageId)

    assert_owner_in_org(db, organization_id, data.ownerId)
    assert_company_in_org(db, organization_id, data.companyId)
    assert_contact_in_org(db, organization_id, data.contactId)

    previous_status = existing.status
    previous_stage_id = existing.stageId

    updated = deal_repository.update(db, organization_id, deal_id, data)
    if not updated:
        raise NotFoundError("Deal")

    _notify_deal_change(
        db, organization_id, updated,
        stage_changed=data.stageId is not None and data.stageId != previous_stage_id and updated.status == "OPEN",
        won_now=updated.status == "WON" and previous_status != "WON",
        lost_now=updated.status == "LOST" and previous_status != "LOST",
    )
    return updated


def change_stage(db: Session, organization_id: str, deal_id: str, data):
    existing = deal_repository.find_by_id(db, organization_id, deal_id)
    if not existing:
        raise NotFoundError("Deal")
    assert_stage_in_pipeline(db, organization_id, existing.pipelineId, data.stageId)

    previous_status = existing.status
    previous_stage_id = existing.stageId

    updated = deal_repository.change_stage(db, organization_id, deal_id, data)
    if not updated:
        raise NotFoundError("Deal")

    _notify_deal_change(
        db, organization_id, updated,
        stage_changed=data.stageId != previous_stage_id and updated.status == "OPEN",
        won_now=updated.status == "WON" and previous_status != "WON",
        lost_now=updated.status == "LOST" and previous_status != "LOST",
    )
    return updated


def remove(db: Session, organization_id: str, deal_id: str):
    if not deal_repository.delete(db, organization_id, deal_id):
        raise NotFoundError("Deal")
