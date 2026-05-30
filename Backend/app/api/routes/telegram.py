import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from telegram import Bot

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models import TelegramReviewQueue, TelegramReviewStatus, User, Worker, WorkerStatus
from app.schemas import MovementOut, TelegramMessage, TelegramReviewEditRequest, TelegramReviewQueueOut, VisionReviewCorrectionRequest
from app.services.ai_extractor import hybrid_parse_amounts
from app.services.decision_engine import build_transaction_decision
from app.services.transaction_service import approve_review_item_as_movement, extract_telegram_event, process_telegram_text_movement, reject_review_item
from app.services.vision_review_service import approve_vision_review_as_expense, create_vision_review_from_telegram_photo, save_vision_review_correction

router = APIRouter(prefix="/telegram", tags=["telegram"])

CONFIRMATION_TTL_MINUTES = 15
CONFIRMATION_CONFIDENCE_THRESHOLD = 0.6
PENDING_CONFIRMATIONS: dict[str, dict] = {}


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    normalized = _normalize_telegram_update(payload)
    if not normalized.telegram_user_id:
        return {"ok": True, "ignored": True}

    try:
        result = process_telegram_message(normalized, db)
        await _send_telegram_reply(payload, result.get("reply"))
    except HTTPException as exc:
        db.rollback()
        await _send_telegram_reply(payload, str(exc.detail))
    except Exception:
        db.rollback()
        await _send_telegram_reply(payload, "No pude procesar el mensaje. Intenta de nuevo o pide un codigo nuevo.")

    return {"ok": True}


@router.post("/simulate")
def simulate_telegram_message(payload: TelegramMessage, db: Session = Depends(get_db)):
    return process_telegram_message(payload, db)


@router.get("/review-queue", response_model=list[TelegramReviewQueueOut])
def list_review_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(TelegramReviewQueue)
        .filter(
            TelegramReviewQueue.company_id == user.company_id,
            TelegramReviewQueue.status == TelegramReviewStatus.pending,
        )
        .order_by(TelegramReviewQueue.created_at.desc())
        .limit(200)
        .all()
    )


@router.post("/review-queue/{item_id}/approve", response_model=MovementOut)
def approve_review_queue_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _review_item(db, user.company_id, item_id)
    try:
        return approve_review_item_as_movement(db, item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/review-queue/{item_id}/reject", response_model=TelegramReviewQueueOut)
def reject_review_queue_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _review_item(db, user.company_id, item_id)
    try:
        return reject_review_item(db, item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/review-queue/{item_id}/edit-and-approve", response_model=MovementOut)
def edit_and_approve_review_queue_item(
    item_id: int,
    payload: TelegramReviewEditRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _review_item(db, user.company_id, item_id)
    try:
        return approve_review_item_as_movement(db, item, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/review-queue/{item_id}/vision/corrections", response_model=TelegramReviewQueueOut)
def save_vision_review_queue_correction(
    item_id: int,
    payload: VisionReviewCorrectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _review_item(db, user.company_id, item_id)
    try:
        return save_vision_review_correction(db, item, payload.model_dump(), reviewer_id=user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/review-queue/{item_id}/vision/approve", response_model=MovementOut)
def approve_vision_review_queue_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _review_item(db, user.company_id, item_id)
    try:
        return approve_vision_review_as_expense(db, item, reviewer_id=user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def process_telegram_message(payload: TelegramMessage, db: Session, worker_confirmed: bool = False):
    is_start_command = bool(payload.text and payload.text.strip().lower().startswith("/start"))

    if is_start_command and payload.invite_code:
        worker = db.query(Worker).filter(Worker.invite_code == payload.invite_code).first()
        if worker:
            db.query(Worker).filter(
                Worker.telegram_user_id == payload.telegram_user_id,
                Worker.id != worker.id,
            ).update({"telegram_user_id": None}, synchronize_session=False)
            worker.telegram_user_id = payload.telegram_user_id
            worker.status = WorkerStatus.active
            db.commit()
            return {
                "reply": (
                    "Listo, ya estas conectado a tu empresa. "
                    "Ahora puedes escribir gastos, ventas o enviar vouchers."
                ),
                "worker_id": worker.id,
            }
        raise HTTPException(status_code=404, detail="Codigo de invitacion invalido o vencido. Pide uno nuevo.")

    worker = db.query(Worker).filter(Worker.telegram_user_id == payload.telegram_user_id).first()

    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no asociado. Envia tu codigo de invitacion.")

    if worker.status == WorkerStatus.disabled:
        raise HTTPException(status_code=403, detail="Este trabajador esta desactivado. Pide al administrador un codigo nuevo.")

    if is_start_command:
        return {
            "reply": (
                "Ya estas conectado a tu empresa. "
                "Escribe algo como: Gaste 120 soles en gasolina."
            ),
            "worker_id": worker.id,
        }

    if payload.photo_url:
        result = create_vision_review_from_telegram_photo(db, worker, payload.photo_url)
        return {
            "reply": "Recibí tu comprobante y lo envié a revisión.",
            "review_item_id": result["review_item"].id,
            "voucher_id": result["voucher"].id,
            "needs_review": True,
        }

    if not payload.text:
        raise HTTPException(status_code=400, detail="Mensaje vacio")

    normalized_answer = _normalize_answer(payload.text)
    if normalized_answer in {"si", "sí", "s"}:
        pending = _pop_pending_confirmation(payload.telegram_user_id)
        if not pending:
            return {"reply": "No hay ningun registro pendiente por confirmar."}
        result = process_telegram_text_movement(db, worker, pending["raw_text"], worker_confirmed=True)
        if result.needs_review or not result.movement:
            return {
                "reply": (
                    "No guarde este mensaje porque aun requiere revision. "
                    "Vuelve a enviarlo indicando el total con claridad."
                ),
                "needs_review": True,
                "reason": result.reason,
                "event": result.event,
            }
        return {"reply": _movement_reply(result.movement, result.event), "movement_id": result.movement.id}

    if normalized_answer in {"corregir", "corrige", "editar", "edita"}:
        _pop_pending_confirmation(payload.telegram_user_id)
        return {"reply": "Envia el mensaje corregido incluyendo producto, cantidad, precio y total."}

    confirmation = _build_confirmation_preview(worker, payload.text)
    if confirmation and not worker_confirmed:
        PENDING_CONFIRMATIONS[payload.telegram_user_id] = {
            "raw_text": payload.text,
            "created_at": datetime.now(timezone.utc),
        }
        return {"reply": confirmation, "needs_confirmation": True}

    result = process_telegram_text_movement(db, worker, payload.text, worker_confirmed=worker_confirmed)
    if result.needs_review or not result.movement:
        return {
            "reply": (
                "No guarde este mensaje porque no detecte un monto total claro. "
                "Escribe el total con palabras como: pague 120.50 o total 120.50."
            ),
            "needs_review": True,
            "reason": result.reason,
            "event": result.event,
        }

    movement = result.movement
    return {"reply": _movement_reply(movement, result.event), "movement_id": movement.id}


def _build_confirmation_preview(worker: Worker, text: str) -> str | None:
    event = extract_telegram_event(text, worker)
    decision = build_transaction_decision(event)
    confidence = float(event.get("confidence") or 0)
    if decision["needs_review"] or not decision["create_movement"] or confidence < CONFIRMATION_CONFIDENCE_THRESHOLD:
        return None

    parsed = hybrid_parse_amounts(text)
    product = _title_value(event.get("product") or parsed.get("product") or "No detectado")
    quantity = _format_quantity(parsed.get("normalized_text") or "", parsed.get("weight"))
    unit_price = parsed.get("unit_price")
    amount = event.get("amount")

    lines = [
        "Entendi esto:",
        "",
        f"Producto: {product}",
    ]
    if quantity:
        lines.append(f"Cantidad: {quantity}")
    if unit_price is not None:
        lines.append(f"Precio unitario: S/{float(unit_price):g}")
    if amount is not None:
        lines.append(f"Monto total: S/{float(amount):.2f}")
    lines.extend(["", "Es correcto? Responde Si o Corregir."])
    return "\n".join(lines)


def _pop_pending_confirmation(telegram_user_id: str) -> dict | None:
    pending = PENDING_CONFIRMATIONS.pop(telegram_user_id, None)
    if not pending:
        return None
    created_at = pending.get("created_at")
    if created_at and datetime.now(timezone.utc) - created_at > timedelta(minutes=CONFIRMATION_TTL_MINUTES):
        return None
    return pending


def _normalize_answer(text: str) -> str:
    return text.strip().lower()


def _title_value(value: str) -> str:
    return " ".join(part.capitalize() for part in str(value).split())


def _format_quantity(normalized_text: str, fallback_weight: float | None) -> str | None:
    combined = re.search(r"\b(\d+(?:[.,]\d+)?)\s+kg\s+(\d+(?:[.,]\d+)?)\s+gramos\b", normalized_text)
    if combined:
        kg = float(combined.group(1).replace(",", "."))
        grams = float(combined.group(2).replace(",", "."))
        return f"{kg + grams / 1000:g} kg"
    if fallback_weight is None:
        return None
    return f"{float(fallback_weight):g} kg"


def _normalize_telegram_update(update: dict) -> TelegramMessage:
    message = update.get("message") or update.get("edited_message") or {}
    user_id = str((message.get("from") or {}).get("id", ""))
    text = message.get("text") or message.get("caption")
    invite_code = None
    if text and text.lower().startswith("/start "):
        invite_code = text.split(" ", 1)[1].strip()
    photo_url = None
    photos = message.get("photo") or []
    if photos:
        photo_url = photos[-1].get("file_id")
    return TelegramMessage(telegram_user_id=user_id, text=text, photo_url=photo_url, invite_code=invite_code)


def _review_item(db: Session, company_id: int, item_id: int) -> TelegramReviewQueue:
    item = (
        db.query(TelegramReviewQueue)
        .filter(TelegramReviewQueue.id == item_id, TelegramReviewQueue.company_id == company_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item de revision no encontrado")
    return item


async def _send_telegram_reply(update: dict, reply: str | None) -> None:
    if not reply or not settings.telegram_bot_token:
        return

    message = update.get("message") or update.get("edited_message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    if not chat_id:
        return

    bot = Bot(token=settings.telegram_bot_token)
    try:
        await bot.send_message(chat_id=chat_id, text=reply)
    except Exception:
        return


def _movement_reply(movement, event: dict) -> str:
    if movement.type.value == "stock":
        return "Stock actualizado correctamente"

    label = {"expense": "gasto", "sale": "venta"}.get(movement.type.value, movement.type.value)
    if float(event.get("confidence") or 0) < 0.8:
        return f"Registrado con duda: {label} S/ {movement.amount:.2f}. Revisa en dashboard."
    return f"Registrado: {label} S/ {movement.amount:.2f}"
