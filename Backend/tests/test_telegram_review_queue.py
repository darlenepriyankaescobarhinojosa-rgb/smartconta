from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
import pytest

from app.models import MovementType
from app.models import Movement, Product, StockMovement, StockMovementType, TelegramReviewQueue, TelegramReviewStatus, Worker
import app.services.transaction_service as transaction_service
from app.services.transaction_service import approve_review_item_as_movement, process_telegram_text_movement, reject_review_item


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _worker():
    return Worker(id=1, company_id=1, name="Telegram", invite_code="TEST")


def test_doubtful_item_goes_to_review_queue():
    db = _db()
    result = process_telegram_text_movement(db, _worker(), "queso 15 kg precio 21 soles")

    assert result.movement is None
    assert result.review_item is not None
    assert result.needs_review is True
    assert db.query(TelegramReviewQueue).count() == 1
    assert db.query(Movement).count() == 0


def test_clear_item_goes_to_movements():
    db = _db()
    result = process_telegram_text_movement(db, _worker(), "pag 120")

    assert result.movement is not None
    assert result.review_item is None
    assert result.needs_review is False
    assert db.query(Movement).count() == 1
    assert db.query(TelegramReviewQueue).count() == 0


def test_approve_review_item_creates_movement():
    db = _db()
    result = process_telegram_text_movement(db, _worker(), "queso 15 kg precio 21 soles")
    movement = approve_review_item_as_movement(db, result.review_item, {"amount": 120, "category": "Materia prima"})

    assert movement.amount == 120
    assert movement.category == "Materia prima"
    assert result.review_item.status == TelegramReviewStatus.corrected
    assert db.query(Movement).count() == 1


def test_reject_review_item_does_not_create_movement():
    db = _db()
    result = process_telegram_text_movement(db, _worker(), "5 kg 740 gramos")
    reject_review_item(db, result.review_item)

    assert result.review_item.status == TelegramReviewStatus.rejected
    assert db.query(Movement).count() == 0


def test_confirmed_low_confidence_item_creates_movement_without_review(monkeypatch):
    db = _db()

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.expense,
            "amount": 120.0,
            "quantity": None,
            "category": "general",
            "description": text,
            "confidence": 0.7,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "pague 120", worker_confirmed=True)

    assert result.movement is not None
    assert result.review_item is None
    assert result.needs_review is False
    assert db.query(Movement).count() == 1
    assert db.query(TelegramReviewQueue).count() == 0


def test_existing_product_is_resolved_before_creating_movement(monkeypatch):
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", is_active=True)
    db.add(product)
    db.commit()
    db.refresh(product)

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.expense,
            "amount": 318.10,
            "quantity": 15.015,
            "category": "materia prima",
            "product": "qso dambo",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "qso dambo pag 318.10")

    assert result.needs_review is False
    assert result.review_item is None
    assert result.movement.product_id == product.id
    assert result.event["product_id"] == product.id
    assert result.event["product_resolution"]["action"] == "reused"


def test_unresolved_product_goes_to_review_without_creating_movement(monkeypatch):
    db = _db()

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.expense,
            "amount": 318.10,
            "quantity": 15.015,
            "category": "materia prima",
            "product": "queso desconocido",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "queso desconocido pag 318.10")

    assert result.needs_review is True
    assert result.movement is None
    assert result.review_item is not None
    assert result.review_item.decision_json["reason"].startswith("product requires review")
    assert db.query(Movement).count() == 0


def test_product_resolver_never_reuses_other_company_product(monkeypatch):
    db = _db()
    db.add(Product(company_id=2, name="Queso Dambo", is_active=True))
    db.commit()

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.expense,
            "amount": 318.10,
            "quantity": 15.015,
            "category": "materia prima",
            "product": "qso dambo",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "qso dambo pag 318.10")

    assert result.needs_review is True
    assert result.movement is None
    assert result.event.get("product_id") is None
    assert db.query(Movement).count() == 0


def test_approve_review_item_reuses_existing_product():
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", is_active=True)
    item = TelegramReviewQueue(
        company_id=1,
        raw_text="qso dambo pag 318.10",
        parsed_json={
            "type": "expense",
            "amount": 318.10,
            "quantity": 15.015,
            "category": "materia prima",
            "product": "qso dambo",
            "description": "qso dambo pag 318.10",
            "confidence": 0.96,
            "needs_review": False,
        },
        decision_json={"resolve_product": True},
        confidence=0.96,
        status=TelegramReviewStatus.pending,
    )
    db.add_all([product, item])
    db.commit()
    db.refresh(product)
    db.refresh(item)

    movement = approve_review_item_as_movement(db, item)

    assert movement.product_id == product.id
    assert item.parsed_json["product_id"] == product.id
    assert item.parsed_json["product_resolution"]["action"] == "reused"


def test_confirmed_stock_event_creates_movement_and_stock_movement(monkeypatch):
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", stock=10, unit="kg", is_active=True)
    db.add(product)
    db.commit()
    db.refresh(product)

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.stock,
            "amount": 0,
            "quantity": 5,
            "category": "inventario",
            "product": "qso dambo",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "ingreso 5 kg qso dambo", worker_confirmed=True)

    assert result.needs_review is False
    assert result.movement is not None
    assert result.stock_movement is not None
    assert result.stock_movement.product_id == product.id
    assert result.stock_movement.previous_stock == 10
    assert result.stock_movement.new_stock == 15
    assert db.query(StockMovement).count() == 1


def test_stock_event_with_unresolved_product_goes_to_review(monkeypatch):
    db = _db()

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.stock,
            "amount": 0,
            "quantity": 5,
            "category": "inventario",
            "product": "producto nuevo",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "ingreso 5 kg producto nuevo", worker_confirmed=True)

    assert result.needs_review is True
    assert result.movement is None
    assert result.review_item is not None
    assert db.query(Movement).count() == 0
    assert db.query(StockMovement).count() == 0


def test_stock_event_negative_stock_is_blocked_before_movement(monkeypatch):
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", stock=2, unit="kg", is_active=True)
    db.add(product)
    db.commit()

    monkeypatch.setattr(
        transaction_service,
        "extract_telegram_event",
        lambda text, worker: {
            "type": MovementType.stock,
            "stock_movement_type": StockMovementType.sale.value,
            "amount": 0,
            "quantity": 5,
            "category": "inventario",
            "product": "qso dambo",
            "description": text,
            "confidence": 0.96,
            "needs_review": False,
        },
    )

    result = process_telegram_text_movement(db, _worker(), "salida 5 kg qso dambo", worker_confirmed=True)

    assert result.needs_review is True
    assert result.reason == "stock cannot be negative"
    assert result.movement is None
    assert db.query(Movement).count() == 0
    assert db.query(StockMovement).count() == 0


def test_stock_application_is_idempotent_for_same_movement(monkeypatch):
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", stock=10, unit="kg", is_active=True)
    db.add(product)
    db.commit()
    db.refresh(product)
    event = {
        "type": MovementType.stock,
        "amount": 0,
        "quantity": 5,
        "category": "inventario",
        "product_id": product.id,
        "product": "Queso Dambo",
        "description": "ingreso 5 kg qso dambo",
        "confidence": 0.96,
        "needs_review": False,
    }
    movement = Movement(
        company_id=1,
        worker_id=1,
        product_id=product.id,
        type=MovementType.stock,
        amount=0,
        quantity=5,
        category="inventario",
        description="ingreso 5 kg qso dambo",
        source="telegram",
        raw_text="ingreso 5 kg qso dambo",
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    first = transaction_service._apply_stock_for_movement(
        db,
        movement,
        event,
        {"update_stock": True},
        worker_id=1,
        source="telegram",
    )
    second = transaction_service._apply_stock_for_movement(
        db,
        movement,
        event,
        {"update_stock": True},
        worker_id=1,
        source="telegram",
    )

    assert second.id == first.id
    assert db.query(StockMovement).count() == 1
    assert product.stock == 15


def test_approve_review_item_applies_stock_once():
    db = _db()
    product = Product(company_id=1, name="Queso Dambo", stock=10, unit="kg", is_active=True)
    item = TelegramReviewQueue(
        company_id=1,
        raw_text="ingreso 5 kg qso dambo",
        parsed_json={
            "type": "stock",
            "amount": 0,
            "quantity": 5,
            "category": "inventario",
            "product": "qso dambo",
            "description": "ingreso 5 kg qso dambo",
            "confidence": 0.96,
            "needs_review": False,
        },
        decision_json={"resolve_product": True, "update_stock": True},
        confidence=0.96,
        status=TelegramReviewStatus.pending,
    )
    db.add_all([product, item])
    db.commit()
    db.refresh(product)
    db.refresh(item)

    movement = approve_review_item_as_movement(db, item)

    assert movement.product_id == product.id
    assert db.query(StockMovement).count() == 1
    db.refresh(product)
    assert product.stock == 15
    with pytest.raises(ValueError, match="ya fue procesado"):
        approve_review_item_as_movement(db, item)
    assert db.query(StockMovement).count() == 1
