from pathlib import Path
import asyncio
import sys

from telegram import Update
from telegram import ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

sys.path.append(str(Path(__file__).resolve().parent))

from app.api.routes.telegram import process_telegram_message
from app.core.config import settings
from app.db.session import SessionLocal
from app.schemas import TelegramMessage


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

    db = SessionLocal()
    try:
        result = process_telegram_message(
            TelegramMessage(telegram_user_id=telegram_user_id, text=text),
            db,
        )
        reply_markup = (
            ReplyKeyboardMarkup([["Si", "Corregir"]], one_time_keyboard=True, resize_keyboard=True)
            if result.get("needs_confirmation")
            else ReplyKeyboardRemove()
        )
        await update.message.reply_text(result.get("reply", "Mensaje procesado."), reply_markup=reply_markup)
    except Exception as exc:
        await update.message.reply_text(
            "No pude registrar el mensaje. Verifica que estes conectado con /start CODIGO.\n"
            f"Detalle: {exc}"
        )
    finally:
        db.close()


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
