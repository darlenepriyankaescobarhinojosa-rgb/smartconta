import logging

from sqlalchemy.orm import Session

from app.models import TelegramReviewQueue, TelegramReviewStatus, Worker


logger = logging.getLogger(__name__)


def enqueue_review_item(db: Session, worker: Worker, raw_text: str, event: dict, decision: dict) -> TelegramReviewQueue:
    existing = (
        db.query(TelegramReviewQueue)
        .filter(
            TelegramReviewQueue.company_id == worker.company_id,
            TelegramReviewQueue.raw_text == raw_text,
            TelegramReviewQueue.status == TelegramReviewStatus.pending,
        )
        .order_by(TelegramReviewQueue.created_at.desc())
        .first()
    )
    if existing:
        logger.info(
            "review_queue_idempotent_hit",
            extra={
                "company_id": worker.company_id,
                "worker_id": worker.id,
                "review_item_id": existing.id,
                "reason": decision.get("reason"),
            },
        )
        return existing

    item = TelegramReviewQueue(
        company_id=worker.company_id,
        raw_text=raw_text,
        parsed_json=_json_safe_event(event),
        decision_json=decision,
        confidence=float(event.get("confidence") or 0),
        status=TelegramReviewStatus.pending,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(
        "review_queue_enqueued",
        extra={
            "company_id": worker.company_id,
            "worker_id": worker.id,
            "review_item_id": item.id,
            "confidence": item.confidence,
            "reason": decision.get("reason"),
        },
    )
    return item


def _json_safe_event(event: dict) -> dict:
    safe = dict(event)
    event_type = safe.get("type")
    safe["type"] = getattr(event_type, "value", event_type)
    return safe
