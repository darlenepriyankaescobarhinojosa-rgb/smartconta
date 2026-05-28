from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Movement, MovementType, User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/profit-and-loss")
def profit_and_loss(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Movement.type, func.coalesce(func.sum(Movement.amount), 0))
        .filter(Movement.company_id == user.company_id)
        .group_by(Movement.type)
        .all()
    )
    totals = {row[0].value: float(row[1]) for row in rows}
    revenue = totals.get(MovementType.sale.value, 0)
    expenses = totals.get(MovementType.expense.value, 0)
    return {"revenue": revenue, "expenses": expenses, "gross_profit": revenue - expenses}

