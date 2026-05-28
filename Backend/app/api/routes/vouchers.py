from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User, Voucher
from app.schemas import VoucherCreate, VoucherOut
from app.services.ocr import extract_voucher_data

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


@router.get("", response_model=list[VoucherOut])
def list_vouchers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Voucher).filter(Voucher.company_id == user.company_id).order_by(Voucher.created_at.desc()).all()


@router.post("", response_model=VoucherOut)
def create_voucher(payload: VoucherCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ocr = extract_voucher_data(payload.file_url)
    voucher = Voucher(company_id=user.company_id, **payload.model_dump(), **ocr)
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    return voucher

