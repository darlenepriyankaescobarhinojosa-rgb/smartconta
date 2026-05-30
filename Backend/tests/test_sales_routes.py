from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.sales import _apply_sale_stock, create_sale
from app.db.session import Base
from app.models import Movement, MovementType, Product, StockMovement, StockMovementType, User, UserRole
from app.schemas import MovementCreate


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


def test_create_sale_uses_stock_service_and_records_stock_movement():
    db = _db()
    product = _product(db, stock=10)
    payload = MovementCreate(
        type=MovementType.expense,
        amount=50,
        quantity=3,
        product_id=product.id,
        description="Venta queso",
    )

    movement = create_sale(payload, db, _user())

    assert movement.type == MovementType.sale
    db.refresh(product)
    assert product.stock == 7
    stock_movement = db.query(StockMovement).one()
    assert stock_movement.product_id == product.id
    assert stock_movement.type == StockMovementType.sale
    assert stock_movement.previous_stock == 10
    assert stock_movement.new_stock == 7
    assert stock_movement.source == "web"
    assert f"movement:{movement.id}" in stock_movement.reason


def test_sale_stock_application_is_idempotent_for_same_movement():
    db = _db()
    product = _product(db, stock=10)
    movement = Movement(
        company_id=1,
        product_id=product.id,
        type=MovementType.sale,
        amount=50,
        quantity=3,
        description="Venta queso",
        source="web",
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    first = _apply_sale_stock(db, 1, movement)
    second = _apply_sale_stock(db, 1, movement)

    assert second.id == first.id
    db.refresh(product)
    assert product.stock == 7
    assert db.query(StockMovement).count() == 1


def test_create_sale_preserves_temporary_negative_stock_compatibility():
    db = _db()
    product = _product(db, stock=2)
    payload = MovementCreate(
        type=MovementType.sale,
        amount=50,
        quantity=5,
        product_id=product.id,
        description="Venta queso",
    )

    create_sale(payload, db, _user())

    db.refresh(product)
    assert product.stock == -3
    assert db.query(StockMovement).count() == 1
