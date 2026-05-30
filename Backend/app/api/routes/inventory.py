from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Product, ProductPriceHistory, StockMovement, User
from app.schemas import (
    ProductPriceHistoryCreate,
    ProductPriceHistoryOut,
    StockMovementCreate,
    StockMovementOut,
)
from app.services.price_service import record_product_price
from app.services.stock_service import apply_stock_movement

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/stock-movements", response_model=list[StockMovementOut])
def list_stock_movements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(StockMovement)
        .filter(StockMovement.company_id == user.company_id)
        .order_by(StockMovement.occurred_on.desc(), StockMovement.created_at.desc())
        .limit(200)
        .all()
    )


@router.post("/stock-movements", response_model=StockMovementOut)
def create_stock_movement(
    payload: StockMovementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.company_id == user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return apply_stock_movement(
        db,
        product,
        payload.type,
        payload.quantity,
        new_stock=payload.new_stock,
        reason=payload.reason,
        occurred_on=payload.occurred_on,
        source="web",
        allow_negative=True,
        allow_negative_quantity=True,
    )


@router.get("/price-history", response_model=list[ProductPriceHistoryOut])
def list_price_history(product_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(ProductPriceHistory).filter(ProductPriceHistory.company_id == user.company_id)
    if product_id:
        query = query.filter(ProductPriceHistory.product_id == product_id)
    return query.order_by(ProductPriceHistory.occurred_on.desc(), ProductPriceHistory.created_at.desc()).limit(200).all()


@router.post("/price-history", response_model=ProductPriceHistoryOut)
def create_price_history(
    payload: ProductPriceHistoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.company_id == user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return record_product_price(
        db,
        product,
        unit_cost=payload.cost,
        price=payload.price,
        occurred_on=payload.occurred_on,
        notes=payload.notes,
        source="web",
        allow_duplicate=True,
    )
