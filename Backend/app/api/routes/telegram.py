from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from telegram import Bot

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models import TelegramReviewQueue, TelegramReviewStatus, User, Voucher, Worker, WorkerStatus
from app.schemas import MovementOut, TelegramMessage, TelegramReviewEditRequest, TelegramReviewQueueOut
from app.services.ocr import extract_voucher_data
from app.services.transaction_service import approve_review_item_as_movement, process_telegram_text_movement, reject_review_item

router = APIRouter(prefix="/telegram", tags=["telegram"])


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


def process_telegram_message(payload: TelegramMessage, db: Session):
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
        ocr = extract_voucher_data(payload.photo_url)
        voucher = Voucher(company_id=worker.company_id, worker_id=worker.id, file_url=payload.photo_url, **ocr)
        db.add(voucher)
        db.commit()
        db.refresh(voucher)
        return {"reply": "Voucher recibido y pendiente de validacion", "voucher_id": voucher.id}

    if not payload.text:
        raise HTTPException(status_code=400, detail="Mensaje vacio")

    result = process_telegram_text_movement(db, worker, payload.text)
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
