from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import Movement, TelegramReviewQueue, TelegramReviewStatus, Worker
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
