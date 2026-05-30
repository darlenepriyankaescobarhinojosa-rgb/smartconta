import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.services.vision_review_service as vision_review_service
from app.api.routes.telegram import process_telegram_message
from app.db.session import Base
from app.models import (
    Movement,
    MovementType,
    Product,
    ProductPriceHistory,
    StockMovement,
    TelegramReviewQueue,
    TelegramReviewStatus,
    Voucher,
    VoucherStatus,
    Worker,
    WorkerStatus,
)
from app.schemas import TelegramMessage
from app.services.transaction_service import approve_review_item_as_movement
from app.services.vision_review_service import approve_vision_review_as_expense, save_vision_review_correction


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _worker():
    return Worker(
        id=1,
        company_id=1,
        name="Telegram",
        telegram_user_id="tg-1",
        invite_code="TEST",
        status=WorkerStatus.active,
    )


def _patch_vision_io(monkeypatch):
    monkeypatch.setattr(
        vision_review_service,
        "download_telegram_file",
        lambda file_id: {"bytes": b"image", "file_id": file_id, "warnings": []},
    )
    monkeypatch.setattr(
        vision_review_service,
        "extract_text_from_image_bytes",
        lambda image_bytes: {
            "text": "Proveedor Norte\nFecha 29/05/2026\nQueso Dambo 15 kg 21 315\nTOTAL S/ 315",
            "confidence": 0.9,
            "warnings": [],
        },
    )


def test_telegram_photo_creates_vision_review_queue(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()

    result = process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)

    item = db.query(TelegramReviewQueue).one()
    voucher = db.query(Voucher).one()
    assert result["reply"] == "Recibí tu comprobante y lo envié a revisión."
    assert result["needs_review"] is True
    assert item.status == TelegramReviewStatus.pending
    assert item.decision_json == {
        "source": "smartconta_vision",
        "create_movement": False,
        "update_stock": False,
        "save_price_history": False,
        "needs_review": True,
        "reason": "vision receipt requires human review",
    }
    assert item.parsed_json["proposal"]["supplier"] == "Proveedor Norte"
    assert item.parsed_json["proposal"]["total_amount"] == 315
    assert item.parsed_json["proposal"]["items"][0]["raw_name"] == "Queso Dambo"
    assert voucher.ocr_text
    assert voucher.detected_amount == 315


def test_telegram_photo_does_not_create_accounting_side_effects(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()

    process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)

    assert db.query(TelegramReviewQueue).count() == 1
    assert db.query(Voucher).count() == 1
    assert db.query(Movement).count() == 0
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0


def test_vision_review_item_cannot_use_movement_approval():
    db = _db()
    item = TelegramReviewQueue(
        company_id=1,
        raw_text="TOTAL S/ 315",
        parsed_json={"source": "smartconta_vision", "proposal": {"total_amount": 315}},
        decision_json={
            "source": "smartconta_vision",
            "create_movement": False,
            "update_stock": False,
            "save_price_history": False,
            "needs_review": True,
        },
        confidence=0.8,
        status=TelegramReviewStatus.pending,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    with pytest.raises(ValueError, match="Las propuestas Vision requieren flujo de aprobación específico"):
        approve_review_item_as_movement(db, item)

    assert db.query(Movement).count() == 0
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0


def test_save_vision_correction_updates_parsed_json_and_voucher(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()
    process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)
    item = db.query(TelegramReviewQueue).one()
    voucher = db.query(Voucher).one()

    updated = save_vision_review_correction(
        db,
        item,
        {
            "supplier": "Lacteos Peru",
            "date": "2026-05-30",
            "total_amount": 320,
            "currency": "PEN",
            "items": [{"raw_name": "Queso Dambo", "quantity": 10, "unit": "kg", "unit_cost": 21, "line_total": 210}],
            "warnings": [],
        },
        reviewer_id=99,
    )

    db.refresh(voucher)
    assert updated.status == TelegramReviewStatus.pending
    assert updated.parsed_json["proposal"]["supplier"] == "Lacteos Peru"
    assert updated.parsed_json["proposal"]["total_amount"] == 320
    assert updated.parsed_json["proposal"]["corrected"] is True
    assert len(updated.parsed_json["vision_corrections"]) == 1
    assert voucher.detected_amount == 320
    assert db.query(Movement).count() == 0
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0


def test_approve_vision_voucher_creates_expense_once(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()
    process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)
    item = db.query(TelegramReviewQueue).one()
    voucher = db.query(Voucher).one()

    movement = approve_vision_review_as_expense(db, item, reviewer_id=99)

    db.refresh(item)
    db.refresh(voucher)
    assert movement.type == MovementType.expense
    assert movement.amount == 315
    assert movement.company_id == 1
    assert movement.worker_id == 1
    assert movement.source == "smartconta_vision"
    assert item.status == TelegramReviewStatus.approved
    assert item.parsed_json["approved_movement_id"] == movement.id
    assert voucher.status == VoucherStatus.validated
    assert voucher.movement_id == movement.id
    assert db.query(Movement).count() == 1
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0
    assert db.query(Product).count() == 0


def test_approve_vision_voucher_blocks_double_approval(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()
    process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)
    item = db.query(TelegramReviewQueue).one()

    approve_vision_review_as_expense(db, item, reviewer_id=99)

    with pytest.raises(ValueError, match="ya fue procesada"):
        approve_vision_review_as_expense(db, item, reviewer_id=99)

    assert db.query(Movement).count() == 1
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0
    assert db.query(Product).count() == 0


def test_vision_approval_uses_existing_idempotent_movement_if_retry_before_status_update(monkeypatch):
    _patch_vision_io(monkeypatch)
    db = _db()
    db.add(_worker())
    db.commit()
    process_telegram_message(TelegramMessage(telegram_user_id="tg-1", photo_url="file-1"), db)
    item = db.query(TelegramReviewQueue).one()

    existing = Movement(
        company_id=1,
        worker_id=1,
        type=MovementType.expense,
        amount=315,
        description="Comprobante Vision - Proveedor Norte - 2026-05-29 [vision_review_item:1]",
        source="smartconta_vision",
        raw_text="Comprobante Vision - Proveedor Norte - 2026-05-29 [vision_review_item:1]",
    )
    db.add(existing)
    db.commit()
    db.refresh(existing)

    movement = approve_vision_review_as_expense(db, item, reviewer_id=99)

    assert movement.id == existing.id
    assert db.query(Movement).count() == 1
    assert db.query(StockMovement).count() == 0
    assert db.query(ProductPriceHistory).count() == 0
    assert db.query(Product).count() == 0
