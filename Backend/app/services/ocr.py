import io
import logging
import re

from PIL import Image, UnidentifiedImageError

from app.core.config import settings


logger = logging.getLogger(__name__)


def extract_voucher_data(file_url: str) -> dict:
    """OCR adapter placeholder.

    In production, download the Telegram file and pass it through Tesseract or
    Google Vision. The function already returns the normalized fields expected
    by the API and database.
    """
    ocr_text = f"OCR pendiente para {file_url}"
    amount = _detect_amount(ocr_text)
    return {
        "ocr_text": ocr_text,
        "detected_amount": amount,
        "status": "pending",
        "validation_notes": "Configura Tesseract o Google Vision para validacion automatica.",
    }


def extract_text_from_image_bytes(image_bytes: bytes) -> dict:
    warnings = []
    if not image_bytes:
        return {"text": "", "confidence": 0.0, "warnings": ["empty image bytes"]}

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except UnidentifiedImageError:
        logger.warning("ocr_unidentified_image")
        return {"text": "", "confidence": 0.0, "warnings": ["invalid or unsupported image"]}
    except Exception as exc:
        logger.warning("ocr_image_open_failed", extra={"error": str(exc)})
        return {"text": "", "confidence": 0.0, "warnings": ["could not open image"]}

    try:
        import pytesseract
        from pytesseract import TesseractError
    except ModuleNotFoundError:
        logger.warning("ocr_pytesseract_not_installed")
        return {"text": "", "confidence": 0.0, "warnings": ["pytesseract is not installed"]}

    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    try:
        data = pytesseract.image_to_data(image, lang="spa+eng", output_type=pytesseract.Output.DICT)
    except TesseractError as exc:
        logger.warning("ocr_tesseract_failed", extra={"error": str(exc)})
        return {"text": "", "confidence": 0.0, "warnings": ["tesseract execution failed"]}
    except FileNotFoundError:
        logger.warning("ocr_tesseract_not_installed")
        return {"text": "", "confidence": 0.0, "warnings": ["tesseract is not installed or not configured"]}
    except Exception as exc:
        logger.warning("ocr_unexpected_error", extra={"error": str(exc)})
        return {"text": "", "confidence": 0.0, "warnings": ["ocr failed"]}

    words = []
    confidences = []
    for text, confidence in zip(data.get("text", []), data.get("conf", []), strict=False):
        clean = (text or "").strip()
        if clean:
            words.append(clean)
        try:
            score = float(confidence)
        except (TypeError, ValueError):
            continue
        if score >= 0:
            confidences.append(score / 100)

    ocr_text = " ".join(words).strip()
    if not ocr_text:
        warnings.append("no text detected")

    confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return {"text": ocr_text, "confidence": round(confidence, 4), "warnings": warnings}


def _detect_amount(text: str) -> float | None:
    match = re.search(r"(?:S/|PEN|TOTAL)\s*(\d+(?:[.,]\d+)?)", text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1).replace(",", "."))
