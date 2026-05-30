import re
from datetime import date


TOTAL_PATTERNS = (
    r"\btotal\s*(?:s/|pen|soles?)?\s*(\d+(?:[.,]\d{1,2})?)",
    r"\bimporte\s+total\s*(?:s/|pen|soles?)?\s*(\d+(?:[.,]\d{1,2})?)",
    r"\bmonto\s*(?:total)?\s*(?:s/|pen|soles?)?\s*(\d+(?:[.,]\d{1,2})?)",
)
DATE_PATTERNS = (
    r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b",
    r"\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b",
)
ITEM_PATTERN = re.compile(
    r"(?P<name>[a-zA-ZáéíóúÁÉÍÓÚñÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ0-9 .-]{2,}?)\s+"
    r"(?P<quantity>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|kilos?|und|unid|unidad|lt|litros?)?\s+"
    r"(?P<unit_cost>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<line_total>\d+(?:[.,]\d+)?))?",
    re.IGNORECASE,
)


def parse_receipt_text(text: str) -> dict:
    warnings = []
    clean_text = _clean_text(text)
    supplier = _detect_supplier(text)
    detected_date = _detect_date(clean_text)
    total = _detect_total(clean_text)
    items = _detect_items(text)

    if not supplier:
        warnings.append("supplier not detected")
    if not detected_date:
        warnings.append("date not detected")
    if total is None:
        warnings.append("total amount not detected")
    if not items:
        warnings.append("items not detected")

    confidence_parts = [
        0.25 if supplier else 0,
        0.2 if detected_date else 0,
        0.35 if total is not None else 0,
        0.2 if items else 0,
    ]
    return {
        "supplier": supplier,
        "date": detected_date,
        "total_amount": total,
        "currency": "PEN",
        "items": items,
        "confidence": round(sum(confidence_parts), 4),
        "warnings": warnings,
    }


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _detect_supplier(text: str) -> str | None:
    lines = [line.strip(" -\t") for line in (text or "").splitlines() if line.strip()]
    for line in lines[:5]:
        if not re.search(r"\b(?:boleta|factura|voucher|ruc|fecha|total)\b", line, re.IGNORECASE):
            return line[:160]
    match = re.search(r"(?:proveedor|senor(?:es)?|razon social)\s*:?\s*([A-Z0-9 .,&-]{3,160})", text, re.IGNORECASE)
    return match.group(1).strip() if match else None


def _detect_date(text: str) -> str | None:
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if not match:
            continue
        try:
            if len(match.group(1)) == 4:
                value = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            else:
                year = int(match.group(3))
                if year < 100:
                    year += 2000
                value = date(year, int(match.group(2)), int(match.group(1)))
            return value.isoformat()
        except ValueError:
            continue
    return None


def _detect_total(text: str) -> float | None:
    for pattern in TOTAL_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            return _to_float(matches[-1])
    return None


def _detect_items(text: str) -> list[dict]:
    items = []
    for line in (text or "").splitlines():
        if re.search(r"\b(?:total|subtotal|igv|ruc|fecha|boleta|factura|voucher)\b", line, re.IGNORECASE):
            continue
        for match in ITEM_PATTERN.finditer(line):
            name = re.sub(r"\b(?:total|subtotal|igv|op gravada)\b", " ", match.group("name"), flags=re.IGNORECASE)
            name = re.sub(r"\s+", " ", name).strip(" .-")
            if len(name) < 3:
                continue
            items.append(
                {
                    "raw_name": name[:160],
                    "quantity": _to_float(match.group("quantity")),
                    "unit": _normalize_unit(match.group("unit")),
                    "unit_cost": _to_float(match.group("unit_cost")),
                    "line_total": _to_float(match.group("line_total")) if match.group("line_total") else None,
                }
            )
    return items[:25]


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    return float(value.replace(",", "."))


def _normalize_unit(value: str | None) -> str | None:
    if not value:
        return None
    value = value.lower()
    if value in {"kilo", "kilos"}:
        return "kg"
    if value in {"unid", "und", "unidad"}:
        return "unidad"
    if value in {"litro", "litros"}:
        return "lt"
    return value
