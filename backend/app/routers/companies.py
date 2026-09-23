"""Ported from src/controllers/company.controller.ts + src/app/api/companies/**."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import CurrentUser, get_current_user
from app.repositories import company_repository
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.serializers import company_detail, company_summary
from app.services import company_service
from app.utils.errors import created, ok

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("")
def list_companies(
    page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100),
    ownerId: str | None = None, industry: str | None = None, search: str | None = None,
    sortBy: str = "createdAt", sortDir: str = "desc",
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    result = company_service.list_companies(
        db, current.organization_id, page=page, page_size=pageSize, owner_id=ownerId,
        industry=industry, search=search, sort_by=sortBy, sort_dir=sortDir,
    )
    return ok({
        "items": [
            company_summary(
                c,
                company_repository.count_contacts(db, c.id),
                company_repository.count_deals(db, c.id),
            )
            for c in result["items"]
        ],
        "total": result["total"], "page": result["page"], "pageSize": result["pageSize"],
    })


@router.post("")
def create_company(payload: CompanyCreate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    company = company_service.create(db, current.organization_id, payload)
    return created(company_summary(company, 0, 0))


@router.get("/duplicate-check")
def duplicate_check(name: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    match = company_service.check_duplicate(db, current.organization_id, name)
    return ok({"id": match.id, "name": match.name} if match else None)


@router.get("/{company_id}")
def get_company(company_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    company = company_service.get_by_id(db, current.organization_id, company_id)
    return ok(company_detail(company))


@router.put("/{company_id}")
def update_company(company_id: str, payload: CompanyUpdate, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    company = company_service.update(db, current.organization_id, company_id, payload)
    return ok(company_summary(
        company,
        company_repository.count_contacts(db, company.id),
        company_repository.count_deals(db, company.id),
    ))


@router.delete("/{company_id}")
def delete_company(company_id: str, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    company_service.remove(db, current.organization_id, company_id)
    return ok({"deleted": True})
