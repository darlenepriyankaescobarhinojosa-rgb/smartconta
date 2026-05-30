from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.inventory import create_price_history, create_stock_movement
from app.db.session import Base
from app.models import Product, ProductPriceHistory, StockMovementType, User, UserRole
from app.schemas import ProductPriceHistoryCreate, StockMovementCreate


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def _user():
    return User(id=1, company_id=1, name="Owner", email="owner@test.com", password_hash="x", role=UserRole.owner)


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


def test_inventory_stock_endpoint_uses_service_without_changing_negative_adjustment_behavior():
    db = _db()
    product = _product(db, stock=10)
    payload = StockMovementCreate(
        product_id=product.id,
        type=StockMovementType.entry,
        quantity=-3,
        reason="manual correction",
    )

    movement = create_stock_movement(payload, db, _user())

    assert movement.previous_stock == 10
    assert movement.new_stock == 7
    assert movement.quantity == -3
    assert movement.source == "web"


def test_inventory_price_endpoint_uses_service_without_deduplicating_web_rows():
    db = _db()
    product = _product(db)
    payload = ProductPriceHistoryCreate(
        product_id=product.id,
        cost=21,
        price=26,
        notes="manual update",
    )

    first = create_price_history(payload, db, _user())
    second = create_price_history(payload, db, _user())

    assert first.id != second.id
    assert db.query(ProductPriceHistory).count() == 2
    assert product.cost == 21
    assert product.price == 26
