from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models import Movement, MovementType, TelegramReviewQueue, TelegramReviewStatus, Worker
from app.schemas import MovementCreate
from app.services.ai_extractor import extract_business_event
from app.services.decision_engine import build_transaction_decision
from app.services.telegram_review_service import enqueue_review_item


REVIEW_CONFIDENCE_THRESHOLD = 0.75


@dataclass
class TransactionResult:
    movement: Movement | None
    event: dict
    decision: dict
    needs_review: bool
    review_item: TelegramReviewQueue | None = None
    reason: str | None = None


def extract_telegram_event(text: str, worker: Worker) -> dict:
    return extract_business_event(text, _company_context(worker))


def process_telegram_text_movement(db: Session, worker: Worker, text: str) -> TransactionResult:
    event = extract_telegram_event(text, worker)
    decision = build_transaction_decision(event)
    should_review = decision["needs_review"] or float(event.get("confidence") or 0) < REVIEW_CONFIDENCE_THRESHOLD
    review_item = enqueue_review_item(db, worker, text, event, decision) if should_review else None
    movement = persist_validated_telegram_event(db, worker, event, text) if decision["create_movement"] and not should_review else None
    return TransactionResult(
        movement=movement,
        event=event,
        decision=decision,
        review_item=review_item,
        needs_review=should_review,
        reason=decision.get("reason") if should_review else None,
    )


def persist_validated_telegram_event(db: Session, worker: Worker, event: dict, raw_text: str) -> Movement | None:
    if event.get("needs_review") or event.get("amount") is None:
        return None

    movement = Movement(
        company_id=worker.company_id,
        worker_id=worker.id,
        type=event["type"],
        amount=event["amount"],
        quantity=event.get("quantity"),
        category=event.get("category"),
        description=event["description"],
        source="telegram",
        ai_confidence=event.get("confidence", 0.75),
        raw_text=raw_text,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def approve_review_item_as_movement(
    db: Session,
    item: TelegramReviewQueue,
    corrections: dict | None = None,
) -> Movement:
    if item.status != TelegramReviewStatus.pending:
        raise ValueError("El item de revision ya fue procesado")

    event = dict(item.parsed_json or {})
    corrections = corrections or {}
    corrected = False

    if corrections.get("amount") is not None:
        event["amount"] = float(corrections["amount"])
        corrected = True
    if corrections.get("category") is not None:
        event["category"] = corrections["category"]
        corrected = True
    if corrections.get("product") is not None:
        event["product"] = corrections["product"]
        corrected = True

    amount = event.get("amount")
    if amount is None:
        raise ValueError("No se puede aprobar sin monto")

    movement = Movement(
        company_id=item.company_id,
        worker_id=None,
        type=_movement_type(event.get("type")),
        amount=float(amount),
        quantity=event.get("quantity"),
        category=event.get("category"),
        description=event.get("description") or item.raw_text,
        source="telegram_review",
        ai_confidence=float(event.get("confidence") or item.confidence or 0),
        raw_text=item.raw_text,
    )
    item.parsed_json = _json_safe_event(event)
    item.status = TelegramReviewStatus.corrected if corrected else TelegramReviewStatus.approved
    item.reviewed_at = datetime.now(timezone.utc)

    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(item)
    return movement


def reject_review_item(db: Session, item: TelegramReviewQueue) -> TelegramReviewQueue:
    if item.status != TelegramReviewStatus.pending:
        raise ValueError("El item de revision ya fue procesado")

    item.status = TelegramReviewStatus.rejected
    item.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


def create_company_movement(db: Session, company_id: int, payload: MovementCreate, source: str = "web") -> Movement:
    movement = Movement(
        company_id=company_id,
        worker_id=payload.worker_id,
        product_id=payload.product_id,
        type=payload.type,
        amount=payload.amount,
        quantity=payload.quantity,
        category=payload.category,
        description=payload.description,
        occurred_on=payload.occurred_on or date.today(),
        source=source,
        ai_confidence=1 if source == "web" else 0,
        raw_text=payload.description,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def _company_context(worker: Worker) -> dict:
    return {
        "business_type": worker.company.business_type.value if worker.company and worker.company.business_type else "other",
        "enabled_modules": worker.company.enabled_modules if worker.company else [],
    }


def _movement_type(value) -> MovementType:
    if isinstance(value, MovementType):
        return value
    if value in {item.value for item in MovementType}:
        return MovementType(value)
    return MovementType.expense


def _json_safe_event(event: dict) -> dict:
    safe = dict(event)
    event_type = safe.get("type")
    safe["type"] = getattr(event_type, "value", event_type)
    return safe
