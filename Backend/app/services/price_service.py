from datetime import date

from sqlalchemy.orm import Session

from app.models import Product, ProductPriceHistory


def record_product_price(
    db: Session,
    product: Product,
    *,
    unit_cost: float,
    price: float | None = None,
    supplier: str | None = None,
    notes: str | None = None,
    occurred_on: date | None = None,
    source: str = "system",
    allow_duplicate: bool = False,
) -> ProductPriceHistory:
    if unit_cost < 0:
        raise ValueError("unit_cost cannot be negative")
    if price is not None and price < 0:
        raise ValueError("price cannot be negative")

    occurred_on = occurred_on or date.today()
    sale_price = float(product.price or 0) if price is None else float(price)
    row_notes = notes if notes is not None else _notes(supplier)
    if not allow_duplicate:
        existing = (
            db.query(ProductPriceHistory)
            .filter(
                ProductPriceHistory.company_id == product.company_id,
                ProductPriceHistory.product_id == product.id,
                ProductPriceHistory.cost == float(unit_cost),
                ProductPriceHistory.price == sale_price,
                ProductPriceHistory.occurred_on == occurred_on,
                ProductPriceHistory.source == source,
                ProductPriceHistory.notes == row_notes,
            )
            .first()
        )
        if existing:
            return existing

    product.cost = float(unit_cost)
    product.price = sale_price
    row = ProductPriceHistory(
        company_id=product.company_id,
        product_id=product.id,
        cost=float(unit_cost),
        price=sale_price,
        occurred_on=occurred_on,
        source=source,
        notes=row_notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.refresh(product)
    return row


def _notes(supplier: str | None) -> str | None:
    if not supplier:
        return None
    return f"Proveedor: {supplier.strip()}"
