from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.telegram import PENDING_CONFIRMATIONS, process_telegram_message
from app.db.session import Base
from app.models import Movement, TelegramReviewQueue, Worker, WorkerStatus
from app.schemas import TelegramMessage


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


def test_valid_message_waits_for_confirmation_before_creating_movement():
    PENDING_CONFIRMATIONS.clear()
    db = _db()
    db.add(_worker())
    db.commit()

    preview = process_telegram_message(TelegramMessage(telegram_user_id="tg-1", text="pag 120"), db)

    assert preview["needs_confirmation"] is True
    assert db.query(Movement).count() == 0
    assert db.query(TelegramReviewQueue).count() == 0

    confirmed = process_telegram_message(TelegramMessage(telegram_user_id="tg-1", text="Si"), db)

    assert confirmed["movement_id"]
    assert db.query(Movement).count() == 1
    assert db.query(TelegramReviewQueue).count() == 0


def test_confirmation_preview_combines_kg_and_grams():
    PENDING_CONFIRMATIONS.clear()
    db = _db()
    db.add(_worker())
    db.commit()

    preview = process_telegram_message(
        TelegramMessage(telegram_user_id="tg-1", text="qso dambo 15kg 15 gr precio 21 sles pag 318.10"),
        db,
    )

    assert preview["needs_confirmation"] is True
    assert "Producto: Queso Dambo" in preview["reply"]
    assert "Cantidad: 15.015 kg" in preview["reply"]
    assert "Precio unitario: S/21" in preview["reply"]
    assert "Monto total: S/318.10" in preview["reply"]
    assert db.query(Movement).count() == 0
