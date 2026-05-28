from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.movements_common import create_company_movement
from app.models import Movement, MovementType, User
from app.schemas import MovementCreate, MovementOut

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=list[MovementOut])
def list_expenses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Movement)
        .filter(Movement.company_id == user.company_id, Movement.type == MovementType.expense)
        .order_by(Movement.created_at.desc())
        .all()
    )


@router.post("", response_model=MovementOut)
def create_expense(payload: MovementCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload.type = MovementType.expense
    return create_company_movement(db, user.company_id, payload)

