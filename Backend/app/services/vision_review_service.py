import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Movement, MovementType, TelegramReviewQueue, TelegramReviewStatus, Voucher, VoucherStatus, Worker
from app.schemas import MovementCreate
from app.services.ocr import extract_text_from_image_bytes
from app.services.product_resolver import resolve_product
from app.services.receipt_parser_service import parse_receipt_text
from app.services.telegram_file_service import download_telegram_file
from app.services.transaction_service import create_company_movement


logger = logging.getLogger(__name__)

VISION_SOURCE = "smartconta_vision"
VISION_APPROVAL_ERROR = "Las propuestas Vision requieren flujo de aprobación específico."


def create_vision_review_from_telegram_photo(db: Session, worker: Worker, file_id: str) -> dict:
    download = download_telegram_file(file_id)
    ocr = extract_text_from_image_bytes(download["bytes"])
    proposal = build_receipt_proposal(db, worker, ocr)
    warnings = [*download.get("warnings", []), *ocr.get("warnings", []), *proposal.get("warnings", [])]

    voucher = Voucher(
        company_id=worker.company_id,
        worker_id=worker.id,
        file_url=file_id,
        ocr_text=ocr.get("text") or "",
        detected_amount=proposal.get("total_amount"),
        status=VoucherStatus.pending,
        validation_notes="; ".join(warnings) if warnings else "Pendiente de revision Vision.",
    )
    db.add(voucher)
    db.flush()

    parsed_json = {
        "source": VISION_SOURCE,
        "voucher_id": voucher.id,
        "file_id": file_id,
        "ocr": ocr,
        "proposal": proposal,
    }
    decision_json = {
        "source": VISION_SOURCE,
        "create_movement": False,
        "update_stock": False,
        "save_price_history": False,
        "needs_review": True,
        "reason": "vision receipt requires human review",
    }
    item = TelegramReviewQueue(
        company_id=worker.company_id,
        raw_text=ocr.get("text") or f"Vision OCR pendiente para {file_id}",
        parsed_json=parsed_json,
        decision_json=decision_json,
        confidence=float(proposal.get("confidence") or 0),
        status=TelegramReviewStatus.pending,
    )
    db.add(item)
    db.commit()
    db.refresh(voucher)
    db.refresh(item)
    logger.info(
        "vision_review_enqueued",
        extra={"company_id": worker.company_id, "worker_id": worker.id, "review_item_id": item.id, "voucher_id": voucher.id},
    )
    return {"review_item": item, "voucher": voucher, "proposal": proposal, "ocr": ocr}


def build_receipt_proposal(db: Session, worker: Worker, ocr: dict) -> dict:
    proposal = parse_receipt_text(ocr.get("text") or "")
    items = []
    for item in proposal.get("items", []):
        enriched = dict(item)
        resolution = resolve_product(db, worker.company_id, item.get("raw_name"), create_if_missing=False)
        enriched["product_id"] = resolution.product.id if resolution.product else None
        enriched["product_resolution"] = {
            "action": resolution.action,
            "confidence": resolution.confidence,
            "normalized_name": resolution.normalized_name,
            "reason": resolution.reason,
            "product_id": resolution.product.id if resolution.product else None,
        }
        items.append(enriched)
    proposal["items"] = items
    proposal["ocr_confidence"] = float(ocr.get("confidence") or 0)
    proposal["confidence"] = round((float(proposal.get("confidence") or 0) + float(ocr.get("confidence") or 0)) / 2, 4)
    return proposal


def save_vision_review_correction(
    db: Session,
    item: TelegramReviewQueue,
    correction: dict,
    *,
    reviewer_id: int | None = None,
) -> TelegramReviewQueue:
    _ensure_vision_item(item)
    _ensure_pending(item)

    parsed = dict(item.parsed_json or {})
    previous_proposal = dict(parsed.get("proposal") or {})
    corrected_proposal = _corrected_proposal(previous_proposal, correction)
    audit_entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "reviewer_id": reviewer_id,
        "previous_proposal": previous_proposal,
        "new_proposal": corrected_proposal,
    }
    parsed["proposal"] = corrected_proposal
    parsed["vision_corrections"] = [*(parsed.get("vision_corrections") or []), audit_entry]
    item.parsed_json = parsed
    item.confidence = float(corrected_proposal.get("confidence") or item.confidence or 0)

    voucher = _voucher_for_item(db, item)
    if voucher:
        voucher.detected_amount = corrected_proposal.get("total_amount")
        voucher.validation_notes = "Correccion Vision guardada. Pendiente de aprobacion."

    db.commit()
    db.refresh(item)
    logger.info(
        "vision_review_correction_saved",
        extra={"company_id": item.company_id, "review_item_id": item.id, "reviewer_id": reviewer_id},
    )
    return item


def approve_vision_review_as_expense(
    db: Session,
    item: TelegramReviewQueue,
    *,
    reviewer_id: int | None = None,
) -> Movement:
    _ensure_vision_item(item)
    _ensure_pending(item)

    parsed = dict(item.parsed_json or {})
    proposal = parsed.get("proposal") or {}
    amount = proposal.get("total_amount")
    if amount is None or float(amount) <= 0:
        raise ValueError("No se puede aprobar una propuesta Vision sin total valido.")

    voucher = _voucher_for_item(db, item)
    if voucher and voucher.movement_id:
        raise ValueError("La propuesta Vision ya fue aprobada.")

    marker = _idempotency_marker(item.id)
    existing = _existing_vision_movement(db, item.company_id, marker)
    if existing:
        _mark_vision_approved(db, item, existing, voucher, reviewer_id=reviewer_id)
        return existing

    movement = create_company_movement(
        db,
        item.company_id,
        MovementCreate(
            type=MovementType.expense,
            amount=float(amount),
            quantity=None,
            category="Comprobante Vision",
            description=_vision_expense_description(proposal, marker),
            worker_id=voucher.worker_id if voucher else None,
            product_id=None,
        ),
        source=VISION_SOURCE,
    )
    _mark_vision_approved(db, item, movement, voucher, reviewer_id=reviewer_id)
    logger.info(
        "vision_review_approved_as_expense",
        extra={"company_id": item.company_id, "review_item_id": item.id, "movement_id": movement.id},
    )
    return movement


def _ensure_vision_item(item: TelegramReviewQueue) -> None:
    if (item.decision_json or {}).get("source") != VISION_SOURCE and (item.parsed_json or {}).get("source") != VISION_SOURCE:
        raise ValueError("El item no es una propuesta Vision.")


def _ensure_pending(item: TelegramReviewQueue) -> None:
    if item.status != TelegramReviewStatus.pending:
        raise ValueError("La propuesta Vision ya fue procesada.")


def _corrected_proposal(previous: dict, correction: dict) -> dict:
    proposal = dict(previous)
    for key in ("supplier", "date", "total_amount", "currency", "warnings"):
        if key in correction:
            proposal[key] = correction[key]
    if "items" in correction:
        proposal["items"] = [dict(item) for item in correction.get("items") or []]
    proposal["corrected"] = True
    return proposal


def _voucher_for_item(db: Session, item: TelegramReviewQueue) -> Voucher | None:
    voucher_id = (item.parsed_json or {}).get("voucher_id")
    if not voucher_id:
        return None
    return db.query(Voucher).filter(Voucher.id == voucher_id, Voucher.company_id == item.company_id).first()


def _idempotency_marker(item_id: int) -> str:
    return f"[vision_review_item:{item_id}]"


def _existing_vision_movement(db: Session, company_id: int, marker: str) -> Movement | None:
    return (
        db.query(Movement)
        .filter(
            Movement.company_id == company_id,
            Movement.source == VISION_SOURCE,
            Movement.raw_text.contains(marker),
        )
        .order_by(Movement.created_at.desc())
        .first()
    )


def _mark_vision_approved(
    db: Session,
    item: TelegramReviewQueue,
    movement: Movement,
    voucher: Voucher | None,
    *,
    reviewer_id: int | None,
) -> None:
    parsed = dict(item.parsed_json or {})
    parsed["approved_movement_id"] = movement.id
    item.parsed_json = parsed
    item.decision_json = {
        **(item.decision_json or {}),
        "create_movement": True,
        "movement_id": movement.id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
    }
    item.status = TelegramReviewStatus.approved
    item.reviewed_at = datetime.now(timezone.utc)
    item.reviewed_by_worker_id = None

    if voucher:
        voucher.movement_id = movement.id
        voucher.status = VoucherStatus.validated
        voucher.validation_notes = "Comprobante Vision aprobado como gasto."

    db.commit()
    db.refresh(item)
    if voucher:
        db.refresh(voucher)


def _vision_expense_description(proposal: dict, marker: str) -> str:
    supplier = proposal.get("supplier") or "Proveedor no detectado"
    detected_date = proposal.get("date") or "fecha no detectada"
    return f"Comprobante Vision - {supplier} - {detected_date} {marker}"
