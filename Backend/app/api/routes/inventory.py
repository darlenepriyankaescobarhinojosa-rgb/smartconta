from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Product, ProductPriceHistory, StockMovement, StockMovementType, User
from app.schemas import (
    ProductPriceHistoryCreate,
    ProductPriceHistoryOut,
    StockMovementCreate,
    StockMovementOut,
)

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

    previous = product.stock
    if payload.new_stock is not None:
        new_stock = payload.new_stock
        quantity = new_stock - previous
    elif payload.type == StockMovementType.sale:
        quantity = -abs(payload.quantity)
        new_stock = previous + quantity
    else:
        quantity = payload.quantity
        new_stock = previous + quantity

    product.stock = new_stock
    movement = StockMovement(
        company_id=user.company_id,
        product_id=product.id,
        type=payload.type,
        previous_stock=previous,
        new_stock=new_stock,
        quantity=quantity,
        unit=product.unit,
        reason=payload.reason,
        occurred_on=payload.occurred_on or date.today(),
        source="web",
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


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
    product.cost = payload.cost
    product.price = payload.price
    row = ProductPriceHistory(
        company_id=user.company_id,
        product_id=product.id,
        cost=payload.cost,
        price=payload.price,
        occurred_on=payload.occurred_on or date.today(),
        notes=payload.notes,
        source="web",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

