from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Debt, DebtPayment, DebtStatus, User
from app.schemas import DebtCreate, DebtOut, DebtPaymentCreate

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("", response_model=list[DebtOut])
def list_debts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Debt).filter(Debt.company_id == user.company_id).order_by(Debt.created_at.desc()).all()


@router.post("", response_model=DebtOut)
def create_debt(payload: DebtCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    debt = Debt(
        company_id=user.company_id,
        type=payload.type,
        counterparty=payload.counterparty,
        original_amount=payload.original_amount,
        balance=payload.original_amount,
        due_on=payload.due_on,
        notes=payload.notes,
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return debt


@router.post("/{debt_id}/payments", response_model=DebtOut)
def add_debt_payment(
    debt_id: int,
    payload: DebtPaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id, Debt.company_id == user.company_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")

    payment = DebtPayment(
        company_id=user.company_id,
        debt_id=debt.id,
        amount=payload.amount,
        paid_on=payload.paid_on or date.today(),
        notes=payload.notes,
    )
    debt.balance = max(0, debt.balance - payload.amount)
    debt.status = DebtStatus.paid if debt.balance == 0 else DebtStatus.partial
    db.add(payment)
    db.commit()
    db.refresh(debt)
    return debt

