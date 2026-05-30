from sqlalchemy.orm import Session

from app.models import TelegramReviewQueue, TelegramReviewStatus, Worker


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
    return item


def _json_safe_event(event: dict) -> dict:
    safe = dict(event)
    event_type = safe.get("type")
    safe["type"] = getattr(event_type, "value", event_type)
    return safe
