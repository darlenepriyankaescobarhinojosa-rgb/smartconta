from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.movements_common import create_company_movement
from app.models import Movement, MovementType, Product, StockMovementType, User
from app.schemas import MovementCreate, MovementOut
from app.services.stock_service import apply_stock_movement

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
    _apply_sale_stock(db, user.company_id, movement)
    return movement


def _apply_sale_stock(db: Session, company_id: int, movement: Movement):
    payload_has_stock_effect = movement.product_id and movement.quantity
    if not payload_has_stock_effect:
        return None

    product = (
        db.query(Product)
        .filter(Product.id == movement.product_id, Product.company_id == company_id)
        .first()
    )
    if not product:
        return None

    quantity = float(movement.quantity)
    movement_type = StockMovementType.sale if quantity >= 0 else StockMovementType.entry
    return apply_stock_movement(
        db,
        product,
        movement_type,
        abs(quantity),
        reason=f"Sale movement #{movement.id}: {movement.description}",
        source="web",
        idempotency_key=f"movement:{movement.id}",
        allow_negative=True,
    )
