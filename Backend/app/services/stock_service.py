import logging
from datetime import date

from sqlalchemy.orm import Session

from app.models import Product, StockMovement, StockMovementType


logger = logging.getLogger(__name__)


def apply_stock_movement(
    db: Session,
    product: Product,
    movement_type: StockMovementType,
    quantity: float,
    *,
    new_stock: float | None = None,
    worker_id: int | None = None,
    reason: str | None = None,
    occurred_on: date | None = None,
    source: str = "system",
    idempotency_key: str | None = None,
    allow_negative: bool = False,
    allow_negative_quantity: bool = False,
) -> StockMovement:
    if quantity is None:
        raise ValueError("quantity is required")
    if quantity < 0 and not allow_negative_quantity:
        raise ValueError("quantity must be positive")

    occurred_on = occurred_on or date.today()
    reason = _reason_with_idempotency(reason, idempotency_key)
    existing = _existing_movement(db, product.company_id, idempotency_key)
    if existing:
        logger.info(
            "stock_movement_idempotent_hit",
            extra={
                "company_id": product.company_id,
                "product_id": product.id,
                "stock_movement_id": existing.id,
                "idempotency_key": idempotency_key,
            },
        )
        return existing

    previous_stock = float(product.stock or 0)
    signed_quantity = _signed_quantity(movement_type, quantity)
    calculated_stock = float(new_stock) if new_stock is not None else previous_stock + signed_quantity
    if calculated_stock < 0 and not allow_negative:
        raise ValueError("stock cannot be negative")

    movement = StockMovement(
        company_id=product.company_id,
        product_id=product.id,
        worker_id=worker_id,
        type=movement_type,
        previous_stock=previous_stock,
        new_stock=calculated_stock,
        quantity=calculated_stock - previous_stock,
        unit=product.unit,
        reason=reason,
        occurred_on=occurred_on,
        source=source,
    )
    product.stock = calculated_stock
    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(product)
    logger.info(
        "stock_movement_applied",
        extra={
            "company_id": product.company_id,
            "product_id": product.id,
            "stock_movement_id": movement.id,
            "movement_type": movement_type.value,
            "previous_stock": previous_stock,
            "new_stock": calculated_stock,
            "source": source,
            "idempotency_key": idempotency_key,
        },
    )
    return movement


def _signed_quantity(movement_type: StockMovementType, quantity: float) -> float:
    if movement_type in {StockMovementType.sale, StockMovementType.loss}:
        return -abs(float(quantity))
    return float(quantity)


def _reason_with_idempotency(reason: str | None, idempotency_key: str | None) -> str | None:
    if not idempotency_key:
        return reason
    marker = f"[idempotency:{idempotency_key}]"
    return f"{reason or ''} {marker}".strip()


def _existing_movement(db: Session, company_id: int, idempotency_key: str | None) -> StockMovement | None:
    if not idempotency_key:
        return None
    marker = f"[idempotency:{idempotency_key}]"
    return (
        db.query(StockMovement)
        .filter(StockMovement.company_id == company_id, StockMovement.reason.contains(marker))
        .order_by(StockMovement.created_at.desc())
        .first()
    )
