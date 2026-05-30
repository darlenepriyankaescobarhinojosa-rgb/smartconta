import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models import Movement, MovementType, Product, StockMovement, StockMovementType, TelegramReviewQueue, TelegramReviewStatus, Worker
from app.schemas import MovementCreate
from app.services.ai_extractor import extract_business_event
from app.services.decision_engine import build_transaction_decision
from app.services.product_resolver import ProductResolution, resolve_product
from app.services.stock_service import apply_stock_movement
from app.services.telegram_review_service import enqueue_review_item


REVIEW_CONFIDENCE_THRESHOLD = 0.75
logger = logging.getLogger(__name__)


@dataclass
class TransactionResult:
    movement: Movement | None
    event: dict
    decision: dict
    needs_review: bool
    review_item: TelegramReviewQueue | None = None
    stock_movement: StockMovement | None = None
    reason: str | None = None


def extract_telegram_event(text: str, worker: Worker) -> dict:
    return extract_business_event(text, _company_context(worker))


def process_telegram_text_movement(db: Session, worker: Worker, text: str, worker_confirmed: bool = False) -> TransactionResult:
    event = extract_telegram_event(text, worker)
    decision = build_transaction_decision(event)
    product_review_reason = _resolve_event_product(db, worker.company_id, event, decision, require_match=True)
    stock_review_reason = _stock_review_reason(db, worker.company_id, event, decision, worker_confirmed=worker_confirmed)
    low_confidence = float(event.get("confidence") or 0) < REVIEW_CONFIDENCE_THRESHOLD
    should_review = decision["needs_review"] or bool(product_review_reason) or bool(stock_review_reason) or (low_confidence and not worker_confirmed)
    if product_review_reason or stock_review_reason:
        decision = dict(decision)
        decision["create_movement"] = False
        decision["needs_review"] = True
        decision["reason"] = product_review_reason or stock_review_reason
    review_item = enqueue_review_item(db, worker, text, event, decision) if should_review else None
    movement = persist_validated_telegram_event(db, worker, event, text) if decision["create_movement"] and not should_review else None
    stock_movement = _apply_stock_for_movement(db, movement, event, decision, worker_id=worker.id, source="telegram") if movement else None
    logger.info(
        "telegram_transaction_processed",
        extra={
            "company_id": worker.company_id,
            "worker_id": worker.id,
            "movement_id": movement.id if movement else None,
            "review_item_id": review_item.id if review_item else None,
            "stock_movement_id": stock_movement.id if stock_movement else None,
            "needs_review": should_review,
            "reason": decision.get("reason") if should_review else None,
            "confidence": event.get("confidence"),
        },
    )
    return TransactionResult(
        movement=movement,
        event=event,
        decision=decision,
        review_item=review_item,
        stock_movement=stock_movement,
        needs_review=should_review,
        reason=decision.get("reason") if should_review else None,
    )


def persist_validated_telegram_event(db: Session, worker: Worker, event: dict, raw_text: str) -> Movement | None:
    if event.get("needs_review") or event.get("amount") is None:
        return None

    movement = Movement(
        company_id=worker.company_id,
        worker_id=worker.id,
        product_id=event.get("product_id"),
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
    logger.info(
        "movement_created",
        extra={
            "company_id": worker.company_id,
            "worker_id": worker.id,
            "movement_id": movement.id,
            "movement_type": getattr(movement.type, "value", movement.type),
            "source": movement.source,
            "product_id": movement.product_id,
        },
    )
    return movement


def approve_review_item_as_movement(
    db: Session,
    item: TelegramReviewQueue,
    corrections: dict | None = None,
) -> Movement:
    if (item.decision_json or {}).get("source") == "smartconta_vision":
        raise ValueError("Las propuestas Vision requieren flujo de aprobación específico.")

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
    _resolve_event_product(db, item.company_id, event, item.decision_json or {}, require_match=False)

    amount = event.get("amount")
    if amount is None:
        raise ValueError("No se puede aprobar sin monto")
    stock_review_reason = _stock_review_reason(db, item.company_id, event, item.decision_json or {}, worker_confirmed=True)
    if stock_review_reason:
        raise ValueError(stock_review_reason)

    movement = Movement(
        company_id=item.company_id,
        worker_id=None,
        product_id=event.get("product_id"),
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
    _apply_stock_for_movement(db, movement, event, item.decision_json or {}, worker_id=None, source="telegram_review")
    logger.info(
        "review_item_approved_as_movement",
        extra={
            "company_id": item.company_id,
            "review_item_id": item.id,
            "movement_id": movement.id,
            "status": item.status.value,
            "corrected": corrected,
        },
    )
    return movement


def reject_review_item(db: Session, item: TelegramReviewQueue) -> TelegramReviewQueue:
    if item.status != TelegramReviewStatus.pending:
        raise ValueError("El item de revision ya fue procesado")

    item.status = TelegramReviewStatus.rejected
    item.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    logger.info(
        "review_item_rejected",
        extra={"company_id": item.company_id, "review_item_id": item.id},
    )
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
    logger.info(
        "movement_created",
        extra={
            "company_id": company_id,
            "worker_id": payload.worker_id,
            "movement_id": movement.id,
            "movement_type": getattr(movement.type, "value", movement.type),
            "source": source,
            "product_id": movement.product_id,
        },
    )
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


def _stock_review_reason(
    db: Session,
    company_id: int,
    event: dict,
    decision: dict,
    *,
    worker_confirmed: bool,
) -> str | None:
    if not decision.get("update_stock"):
        return None
    if not worker_confirmed:
        return "stock update requires human confirmation"
    if not event.get("product_id"):
        return "stock update requires resolved product"
    if event.get("quantity") is None:
        return "stock update requires quantity"

    product = _stock_product(db, company_id, event.get("product_id"))
    if not product:
        return "stock update requires valid product"

    quantity = float(event.get("quantity") or 0)
    if quantity <= 0:
        return "stock update requires positive quantity"

    movement_type = _stock_movement_type(event)
    signed_quantity = -abs(quantity) if movement_type in {StockMovementType.sale, StockMovementType.loss} else quantity
    if float(product.stock or 0) + signed_quantity < 0:
        return "stock cannot be negative"
    return None


def _apply_stock_for_movement(
    db: Session,
    movement: Movement,
    event: dict,
    decision: dict,
    *,
    worker_id: int | None,
    source: str,
) -> StockMovement | None:
    if not decision.get("update_stock"):
        return None
    product = _stock_product(db, movement.company_id, event.get("product_id"))
    if not product or event.get("quantity") is None:
        return None
    return apply_stock_movement(
        db,
        product,
        _stock_movement_type(event),
        float(event["quantity"]),
        worker_id=worker_id,
        reason=f"Movement #{movement.id}: {event.get('description') or movement.raw_text or ''}".strip(),
        source=source,
        idempotency_key=f"movement:{movement.id}",
    )


def _stock_product(db: Session, company_id: int, product_id: int | None) -> Product | None:
    if not product_id:
        return None
    return db.query(Product).filter(Product.id == product_id, Product.company_id == company_id).first()


def _stock_movement_type(event: dict) -> StockMovementType:
    value = event.get("stock_movement_type") or event.get("stock_type")
    if isinstance(value, StockMovementType):
        return value
    if value in {item.value for item in StockMovementType}:
        return StockMovementType(value)
    if _movement_type(event.get("type")) == MovementType.sale:
        return StockMovementType.sale
    return StockMovementType.entry


def _resolve_event_product(
    db: Session,
    company_id: int,
    event: dict,
    decision: dict,
    *,
    require_match: bool,
) -> str | None:
    if not decision.get("resolve_product") or not event.get("product"):
        return None

    resolution = resolve_product(db, company_id, event.get("product"), create_if_missing=False)
    event["product_resolution"] = _product_resolution_payload(resolution)
    if resolution.product:
        event["product_id"] = resolution.product.id
        event["product"] = resolution.product.name
        return None

    event.pop("product_id", None)
    if require_match:
        return f"product requires review: {resolution.reason}"
    return None


def _product_resolution_payload(resolution: ProductResolution) -> dict:
    return {
        "action": resolution.action,
        "confidence": resolution.confidence,
        "normalized_name": resolution.normalized_name,
        "reason": resolution.reason,
        "product_id": resolution.product.id if resolution.product else None,
    }


def _json_safe_event(event: dict) -> dict:
    safe = dict(event)
    event_type = safe.get("type")
    safe["type"] = getattr(event_type, "value", event_type)
    return safe
