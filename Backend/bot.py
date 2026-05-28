from pathlib import Path
import asyncio
import sys

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

sys.path.append(str(Path(__file__).resolve().parent))

from app.api.routes.telegram import process_telegram_message
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Movement, Worker
from app.schemas import TelegramMessage
from app.services.ai_extractor import extract_business_event


PENDING_EVENTS: dict[str, dict] = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_user_id = str(update.effective_user.id)
    invite_code = context.args[0] if context.args else None

    if not invite_code:
        await update.message.reply_text(
            "Hola. Para conectarte con tu empresa envia: /start CODIGO\n"
            "Pide ese codigo al administrador de SmartConta."
        )
        return

    db = SessionLocal()
    try:
        result = process_telegram_message(
            TelegramMessage(telegram_user_id=telegram_user_id, invite_code=invite_code, text=f"/start {invite_code}"),
            db,
        )
        await update.message.reply_text(result.get("reply", "Trabajador conectado correctamente."))
    except Exception as exc:
        await update.message.reply_text(f"No pude conectarte: {exc}")
    finally:
        db.close()


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_user_id = str(update.effective_user.id)
    text = (update.message.text or "").strip()
    normalized = text.lower()

    if normalized in {"si", "sí", "s"}:
      await confirm_pending(update, telegram_user_id)
      return

    if normalized in {"no", "n", "cancelar"}:
      PENDING_EVENTS.pop(telegram_user_id, None)
      await update.message.reply_text("Registro cancelado. No se guardo nada.")
      return

    db = SessionLocal()
    try:
        worker = db.query(Worker).filter(Worker.telegram_user_id == telegram_user_id).first()
        if not worker:
            await update.message.reply_text("Primero conectate con tu codigo: /start CODIGO")
            return

        event = extract_business_event(
            text,
            {
                "business_type": worker.company.business_type.value if worker.company and worker.company.business_type else "other",
                "enabled_modules": worker.company.enabled_modules if worker.company else [],
            },
        )
        PENDING_EVENTS[telegram_user_id] = {
            "worker_id": worker.id,
            "company_id": worker.company_id,
            "event": event,
            "raw_text": text,
        }
        await update.message.reply_text(_confirmation_text(event))
    except Exception as exc:
        await update.message.reply_text(
            "No pude registrar el mensaje. Verifica que estes conectado con /start CODIGO.\n"
            f"Detalle: {exc}"
        )
    finally:
        db.close()


async def confirm_pending(update: Update, telegram_user_id: str) -> None:
    pending = PENDING_EVENTS.pop(telegram_user_id, None)
    if not pending:
        await update.message.reply_text("No hay ningun registro pendiente por confirmar.")
        return

    event = pending["event"]
    db = SessionLocal()
    try:
        movement = Movement(
            company_id=pending["company_id"],
            worker_id=pending["worker_id"],
            type=event["type"],
            amount=event["amount"],
            quantity=event.get("quantity"),
            category=event.get("category"),
            description=event["description"],
            source="telegram",
            ai_confidence=event.get("confidence", 0.75),
            raw_text=pending["raw_text"],
        )
        db.add(movement)
        db.commit()
        db.refresh(movement)
        await update.message.reply_text(f"Guardado: {movement.type.value} por S/ {movement.amount:.2f}")
    except Exception as exc:
        await update.message.reply_text(f"No pude guardar el registro: {exc}")
    finally:
        db.close()


def _confirmation_text(event: dict) -> str:
    event_labels = {
        "sale": "Venta",
        "expense": "Gasto",
        "stock": "Stock",
    }
    event_type = event.get("type")
    event_value = getattr(event_type, "value", str(event_type))
    label = event_labels.get(event_value, event_value)
    amount = float(event.get("amount") or 0)
    category = event.get("category") or "Sin categoria"
    quantity = event.get("quantity")

    lines = [
        "Entendi esto:",
        f"Tipo: {label}",
        f"Monto: S/ {amount:.2f}",
        f"Categoria: {category}",
    ]
    if quantity:
        lines.append(f"Cantidad: {quantity}")
    lines.extend([
        "",
        "Responde SI para guardar o NO para cancelar.",
    ])
    return "\n".join(lines)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    photo = update.message.photo[-1]
    db = SessionLocal()
    try:
        result = process_telegram_message(
            TelegramMessage(
                telegram_user_id=str(update.effective_user.id),
                photo_url=photo.file_id,
                text=update.message.caption,
            ),
            db,
        )
        await update.message.reply_text(result.get("reply", "Voucher recibido."))
    except Exception as exc:
        await update.message.reply_text(
            "No pude registrar el voucher. Verifica que estes conectado con /start CODIGO.\n"
            f"Detalle: {exc}"
        )
    finally:
        db.close()


def main() -> None:
    if not settings.telegram_bot_token:
        raise RuntimeError("Falta TELEGRAM_BOT_TOKEN en Backend/.env")

    asyncio.set_event_loop(asyncio.new_event_loop())
    app = Application.builder().token(settings.telegram_bot_token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    print("SmartConta Telegram bot escuchando mensajes...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
