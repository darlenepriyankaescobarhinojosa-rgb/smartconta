import logging
import urllib.error
import urllib.request

from app.core.config import settings


logger = logging.getLogger(__name__)


def download_telegram_file(file_id: str) -> dict:
    if not settings.telegram_bot_token:
        logger.warning("telegram_file_download_missing_token")
        return {"bytes": b"", "file_id": file_id, "warnings": ["telegram bot token is not configured"]}
    if not file_id:
        return {"bytes": b"", "file_id": file_id, "warnings": ["telegram file_id is required"]}

    try:
        file_path = _telegram_file_path(file_id)
        url = f"https://api.telegram.org/file/bot{settings.telegram_bot_token}/{file_path}"
        with urllib.request.urlopen(url, timeout=20) as response:
            image_bytes = response.read()
        logger.info("telegram_file_downloaded", extra={"file_id": file_id, "size": len(image_bytes)})
        return {"bytes": image_bytes, "file_id": file_id, "warnings": []}
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning("telegram_file_download_failed", extra={"file_id": file_id, "error": str(exc)})
        return {"bytes": b"", "file_id": file_id, "warnings": ["telegram file download failed"]}


def download_telegram_photo(photo) -> dict:
    file_id = getattr(photo, "file_id", None)
    if isinstance(photo, dict):
        file_id = photo.get("file_id")
    return download_telegram_file(file_id)


def _telegram_file_path(file_id: str) -> str:
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/getFile?file_id={file_id}"
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = response.read().decode("utf-8")
    import json

    data = json.loads(payload)
    if not data.get("ok") or not data.get("result", {}).get("file_path"):
        raise ValueError("telegram getFile did not return a file_path")
    return data["result"]["file_path"]
