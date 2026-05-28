from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.movements_common import create_company_movement
from app.models import Movement, MovementType, Product, User
from app.schemas import MovementCreate, MovementOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[MovementOut])
def list_sales(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Movement)
        .filter(Movement.company_id == user.company_id, Movement.type == MovementType.sale)
        .order_by(Movement.created_at.desc())
        .all()
    )


@router.post("", response_model=MovementOut)
def create_sale(payload: MovementCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload.type = MovementType.sale
    movement = create_company_movement(db, user.company_id, payload)
    if payload.product_id and payload.quantity:
        product = (
            db.query(Product)
            .filter(Product.id == payload.product_id, Product.company_id == user.company_id)
            .first()
        )
        if product:
            product.stock -= payload.quantity
            db.commit()
    return movement

