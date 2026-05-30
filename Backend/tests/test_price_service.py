import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import Product, ProductPriceHistory
from app.services.price_service import record_product_price


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def _product(db):
    product = Product(
        company_id=1,
        name="Queso Dambo",
        stock=10,
        cost=20,
        price=25,
        unit="kg",
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def test_record_product_price_updates_product_and_history():
    db = _db()
    product = _product(db)

    history = record_product_price(
        db,
        product,
        unit_cost=21,
        supplier="Proveedor Norte",
        source="telegram",
    )

    assert product.cost == 21
    assert product.price == 25
    assert history.cost == 21
    assert history.price == 25
    assert history.source == "telegram"
    assert "Proveedor Norte" in history.notes


def test_record_product_price_is_idempotent_for_same_values():
    db = _db()
    product = _product(db)

    first = record_product_price(
        db,
        product,
        unit_cost=21,
        supplier="Proveedor Norte",
        source="telegram",
    )
    second = record_product_price(
        db,
        product,
        unit_cost=21,
        supplier="Proveedor Norte",
        source="telegram",
    )

    assert second.id == first.id
    assert db.query(ProductPriceHistory).count() == 1


def test_record_product_price_rejects_negative_values():
    db = _db()
    product = _product(db)

    with pytest.raises(ValueError, match="unit_cost cannot be negative"):
        record_product_price(db, product, unit_cost=-1)
