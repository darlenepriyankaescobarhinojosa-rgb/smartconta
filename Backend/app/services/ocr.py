import re


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


def _detect_amount(text: str) -> float | None:
    match = re.search(r"(?:S/|PEN|TOTAL)\s*(\d+(?:[.,]\d+)?)", text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1).replace(",", "."))

