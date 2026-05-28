from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import BusinessType
from app.models import User
from app.schemas import CompanyOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/company", response_model=CompanyOut)
def company_settings(user: User = Depends(get_current_user)):
    return user.company


class CompanySettingsUpdate(BaseModel):
    business_type: BusinessType | None = None
    enabled_modules: list[str] | None = None


@router.put("/company", response_model=CompanyOut)
def update_company_settings(
    payload: CompanySettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.business_type is not None:
        user.company.business_type = payload.business_type
    if payload.enabled_modules is not None:
        user.company.enabled_modules = payload.enabled_modules
    db.commit()
    db.refresh(user.company)
    return user.company
