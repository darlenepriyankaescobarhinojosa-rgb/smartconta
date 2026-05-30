import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import Product, StockMovement, StockMovementType
from app.services.stock_service import apply_stock_movement


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def _product(db, stock=10):
    product = Product(
        company_id=1,
        name="Queso Dambo",
        stock=stock,
        cost=20,
        price=25,
        unit="kg",
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def test_apply_stock_entry_updates_product_and_records_movement():
    db = _db()
    product = _product(db, stock=10)

    movement = apply_stock_movement(
        db,
        product,
        StockMovementType.entry,
        5,
        source="test",
        reason="purchase",
    )

    assert product.stock == 15
    assert movement.previous_stock == 10
    assert movement.new_stock == 15
    assert movement.quantity == 5
    assert movement.source == "test"


def test_apply_stock_sale_prevents_negative_stock():
    db = _db()
    product = _product(db, stock=2)

    with pytest.raises(ValueError, match="stock cannot be negative"):
        apply_stock_movement(db, product, StockMovementType.sale, 3)

    assert db.query(StockMovement).count() == 0


def test_apply_stock_movement_is_idempotent_with_key():
    db = _db()
    product = _product(db, stock=10)

    first = apply_stock_movement(
        db,
        product,
        StockMovementType.entry,
        5,
        idempotency_key="telegram:123",
    )
    second = apply_stock_movement(
        db,
        product,
        StockMovementType.entry,
        5,
        idempotency_key="telegram:123",
    )

    assert second.id == first.id
    assert product.stock == 15
    assert db.query(StockMovement).count() == 1


def test_apply_stock_adjustment_sets_new_stock():
    db = _db()
    product = _product(db, stock=10)

    movement = apply_stock_movement(
        db,
        product,
        StockMovementType.adjustment,
        0,
        new_stock=7,
        reason="inventory correction",
    )

    assert product.stock == 7
    assert movement.previous_stock == 10
    assert movement.new_stock == 7
    assert movement.quantity == -3
