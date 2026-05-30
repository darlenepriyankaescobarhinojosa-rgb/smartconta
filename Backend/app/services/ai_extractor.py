import json
import logging
import re
import unicodedata
from dataclasses import dataclass

from app.core.config import settings
from app.models import MovementType

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """
Eres el extractor contable de SmartConta. Convierte mensajes de trabajadores en JSON estricto:
type: sale|expense|stock, amount: number|null, quantity: number|null, category: string|null,
description: string, confidence: number entre 0 y 1, needs_review: boolean.
Usa PEN si el trabajador menciona soles. No inventes montos.

Reglas criticas:
- amount SOLO es dinero total pagado o cobrado.
- No uses como amount numeros asociados a kg, kilos, gramos, g, peso o cantidad.
- No uses como amount precios unitarios.
- Si no hay total claro con pague, pagué, total, gasto, gaste, monto, cancele o cancelé, devuelve amount null y needs_review true.
- Si el mensaje dice "precio 21 soles" o "costo 17 soles kilos", eso es precio unitario, no total.
- La extraccion heuristica previa es la fuente de verdad para amount. No la contradigas.
"""

TOTAL_KEYWORDS = ("pague", "pago", "pag", "total", "monto", "cancele", "abone", "abono", "gaste", "gasto")
UNIT_PRICE_KEYWORDS = ("precio", "costo", "cuesta", "vale", "unitario")
EXPENSE_KEYWORDS = ("gaste", "gasto", "pague", "pago", "cancele", "abone")
PURCHASE_KEYWORDS = ("compre", "compra", "compramos", "mercaderia", "proveedor", "insumo", "material")
SALE_KEYWORDS = ("vendi", "venta", "cobre", "cobro", "vendido", "cliente")
STOCK_KEYWORDS = ("ingreso", "entro", "entrada", "stock", "inventario", "mercaderia", "quedan", "queda", "recibi", "llego")
PRODUCT_HINT_KEYWORDS = ("queso", "leche", "dambo", "paria", "cabra", "puno", "insumo", "material", "mercaderia")
WEIGHT_UNITS_PATTERN = r"(?:kg|kilo|kilos|kilogramo|kilogramos|gramo|gramos|grs|gr|g)\b"
COMMON_REPLACEMENTS = {
    "qso": "queso",
    "kso": "queso",
    "qeso": "queso",
    "ques": "queso",
    "sles": "soles",
    "sls": "soles",
    "sols": "soles",
    "sole": "soles",
    "pag": "pague",
    "pgo": "pague",
    "pago": "pague",
    "pagado": "pague",
    "gto": "gasto",
    "gste": "gaste",
    "vta": "venta",
    "vndi": "vendi",
    "ing": "ingreso",
    "entro": "ingreso",
    "entraron": "ingreso",
    "gr": "gramos",
    "grs": "gramos",
    "g": "gramos",
    "gramo": "gramos",
    "kilo": "kg",
    "kilos": "kg",
    "kilogramo": "kg",
    "kilogramos": "kg",
}


@dataclass
class NumberCandidate:
    value: float
    raw: str
    start: int
    end: int
    role: str | None = None
    confidence: float = 0.0


def extract_business_event(text: str, company_context: dict | None = None) -> dict:
    parsed = hybrid_parse(text)
    logger.info(
        "telegram_parse_hints parsed_amount_source=%s classification_reason=%s validation_rejection_reason=%s confidence=%s needs_review=%s",
        parsed.get("parsed_amount_source"),
        parsed.get("classification_reason"),
        parsed.get("validation_rejection_reason"),
        parsed.get("confidence"),
        parsed.get("needs_review"),
    )

    if settings.openai_api_key:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": f"{SYSTEM_PROMPT}\n{_context_prompt(company_context)}"},
                {
                    "role": "user",
                    "content": (
                        f"Mensaje normalizado: {parsed['normalized_text']}\n"
                        f"Extraccion heuristica previa: {json.dumps(parsed, ensure_ascii=False)}\n"
                        "Devuelve JSON estricto y conserva amount=null si la heuristica marco needs_review."
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        ai_data = json.loads(response.choices[0].message.content or "{}")
        return validate_result(ai_data, text, parsed)

    return validate_result({}, text, parsed, company_context)


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-z0-9.,/ ]+", " ", normalized)
    normalized = re.sub(r"(\d)(kg|kilo|kilos|gramos|gramo|grs|gr|g)\b", r"\1 \2", normalized)
    normalized = re.sub(r"\b(kg|kilo|kilos|gramos|gramo|grs|gr|g)(\d)", r"\1 \2", normalized)
    normalized = re.sub(r"\bs/\s*(\d)", r"soles \1", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    words = [COMMON_REPLACEMENTS.get(word, word) for word in normalized.split()]
    return " ".join(words)


def hybrid_parse(text: str) -> dict:
    normalized = normalize_text(text)
    candidates = _number_candidates(normalized)
    movement_type, classification_reason = _classify_type(normalized)

    if not candidates:
        return _parsed_result(
            normalized,
            movement_type,
            classification_reason,
            None,
            None,
            None,
            0.2,
            "no numbers detected",
            "none",
            "no numbers detected",
            [],
            True,
        )

    _classify_candidates(normalized, candidates)
    total = _choose_explicit_total(candidates)
    unit_price = _choose_role(candidates, "unit_price")
    weight = _choose_role(candidates, "weight")

    if not total:
        return _parsed_result(
            normalized,
            movement_type,
            classification_reason,
            None,
            unit_price,
            weight,
            0.2,
            "no explicit total detected",
            "none",
            "no explicit total detected",
            candidates,
            True,
        )

    if _same_amount(total, unit_price) or _same_amount(total, weight):
        return _parsed_result(
            normalized,
            movement_type,
            classification_reason,
            None,
            unit_price,
            weight,
            0.2,
            "amount matches weight or unit price",
            "rejected",
            "amount matches weight or unit price",
            candidates,
            True,
        )

    return _parsed_result(
        normalized,
        movement_type,
        classification_reason,
        total,
        unit_price,
        weight,
        total.confidence,
        "explicit total detected",
        "regex",
        None,
        candidates,
        total.confidence < 0.6,
    )


def hybrid_parse_amounts(text: str) -> dict:
    return hybrid_parse(text)


def validate_result(
    ai_data: dict,
    raw_text: str,
    parsed: dict | None = None,
    company_context: dict | None = None,
) -> dict:
    parsed = parsed or hybrid_parse(raw_text)
    normalized = parsed["normalized_text"]
    confidence = min(float(ai_data.get("confidence") or parsed["confidence"]), float(parsed["confidence"]))
    needs_review = bool(parsed["needs_review"] or confidence < 0.6)
    amount = parsed["total_amount"] if not needs_review else None
    reason = parsed["reason"] if needs_review else "validated"
    validation_rejection_reason = parsed.get("validation_rejection_reason") if needs_review else None

    ai_type = ai_data.get("type")
    movement_type = _movement_type(ai_type, parsed["type"], normalized, company_context)
    logger.info(
        "telegram_validation parsed_amount_source=%s classification_reason=%s validation_rejection_reason=%s final_type=%s needs_review=%s",
        parsed.get("parsed_amount_source"),
        parsed.get("classification_reason"),
        validation_rejection_reason,
        movement_type.value,
        needs_review,
    )

    return {
        "type": movement_type,
        "amount": amount,
        "currency": "PEN",
        "quantity": parsed.get("weight") if movement_type == MovementType.stock else None,
        "category": ai_data.get("category") or _category(normalized),
        "product": parsed.get("product") or ai_data.get("product") or "",
        "description": ai_data.get("description") or raw_text,
        "confidence": confidence,
        "needs_review": needs_review,
        "reason": reason,
    }


def _parsed_result(
    normalized: str,
    movement_type: str,
    classification_reason: str,
    total: NumberCandidate | None,
    unit_price: NumberCandidate | None,
    weight: NumberCandidate | None,
    confidence: float,
    reason: str,
    parsed_amount_source: str,
    validation_rejection_reason: str | None,
    candidates: list[NumberCandidate],
    needs_review: bool,
) -> dict:
    return {
        "type": movement_type,
        "total_amount": total.value if total else None,
        "unit_price": unit_price.value if unit_price else None,
        "weight": weight.value if weight else None,
        "product": _extract_product_hint(normalized, candidates),
        "currency": "PEN",
        "confidence": confidence,
        "needs_review": needs_review,
        "reason": reason,
        "parsed_amount_source": parsed_amount_source,
        "classification_reason": classification_reason,
        "validation_rejection_reason": validation_rejection_reason,
        "normalized_text": normalized,
        "candidates": [
            {
                "value": candidate.value,
                "raw": candidate.raw,
                "role": candidate.role or "unknown",
                "confidence": candidate.confidence,
            }
            for candidate in candidates
        ],
    }


def _classify_type(text: str) -> tuple[str, str]:
    if _has_keyword(text, SALE_KEYWORDS):
        return "sale", "sale keyword detected"

    has_physical_quantity = bool(re.search(WEIGHT_UNITS_PATTERN, text))
    has_stock_signal = _has_keyword(text, STOCK_KEYWORDS)
    has_payment_signal = _has_keyword(text, EXPENSE_KEYWORDS)
    has_price_signal = _has_keyword(text, UNIT_PRICE_KEYWORDS)
    has_purchase_signal = _has_keyword(text, PURCHASE_KEYWORDS) or _has_keyword(text, PRODUCT_HINT_KEYWORDS)

    if has_stock_signal and has_physical_quantity and not has_payment_signal and not has_price_signal:
        return "stock", "stock keyword with physical quantity"
    if has_purchase_signal and (has_physical_quantity or has_price_signal):
        return "purchase", "product purchase signal with quantity or price"
    if has_payment_signal:
        return "expense", "payment or expense keyword detected"
    if has_physical_quantity and not has_price_signal:
        return "stock", "physical quantity without money context"
    return "expense", "default expense classification"


def _movement_type(ai_type: str | None, parsed_type: str, text: str, company_context: dict | None = None) -> MovementType:
    allowed = {"sale", "expense", "stock"}
    selected = ai_type if ai_type in allowed else parsed_type
    if selected == "purchase":
        return MovementType.expense
    if selected == "stock":
        modules = set((company_context or {}).get("enabled_modules") or [])
        if "inventory" in modules or any(word in text for word in STOCK_KEYWORDS):
            return MovementType.stock
        return MovementType.expense
    if selected == "sale":
        return MovementType.sale
    return MovementType.expense


def _number_candidates(text: str) -> list[NumberCandidate]:
    return [
        NumberCandidate(value=float(match.group(1).replace(",", ".")), raw=match.group(1), start=match.start(), end=match.end())
        for match in re.finditer(r"(?<!\w)(\d+(?:[.,]\d+)?)(?!\w)", text)
    ]


def _classify_candidates(text: str, candidates: list[NumberCandidate]) -> None:
    for candidate in candidates:
        before = text[max(0, candidate.start - 45) : candidate.start]
        after = text[candidate.end : min(len(text), candidate.end + 45)]

        if _is_weight_context(before, after):
            candidate.role = "weight"
            candidate.confidence = 0.95
            continue

        money_role = _money_context_role(before, after)
        if money_role == "total":
            candidate.role = "total"
            candidate.confidence = 0.96
            continue
        if money_role == "unit_price":
            candidate.role = "unit_price"
            candidate.confidence = 0.92


def _choose_explicit_total(candidates: list[NumberCandidate]) -> NumberCandidate | None:
    totals = [candidate for candidate in candidates if candidate.role == "total"]
    if not totals:
        return None
    return max(totals, key=lambda candidate: (candidate.confidence, candidate.start))


def _choose_role(candidates: list[NumberCandidate], role: str) -> NumberCandidate | None:
    matches = [candidate for candidate in candidates if candidate.role == role]
    if not matches:
        return None
    return max(matches, key=lambda candidate: candidate.confidence)


def _money_context_role(before: str, after: str) -> str | None:
    after_role = _nearest_keyword_after(after)
    if after_role == "total":
        return "total"
    before_role = _nearest_keyword_before(before)
    if before_role:
        return before_role
    if bool(re.search(r"^\s*(?:soles?|s/)?\s*(?:por\s+)?(?:kg|kilos?|kilogramos?)\b", after)):
        return "unit_price"
    return after_role


def _is_weight_context(before: str, after: str) -> bool:
    return bool(re.search(r"^\s*" + WEIGHT_UNITS_PATTERN, after)) or bool(
        re.search(r"(?:peso|" + WEIGHT_UNITS_PATTERN + r")\s*$", before)
    )


def _nearest_keyword_before(text: str) -> str | None:
    words = text.strip().split()[-4:]
    for word in reversed(words):
        if word in TOTAL_KEYWORDS:
            return "total"
        if word in UNIT_PRICE_KEYWORDS:
            return "unit_price"
    return None


def _nearest_keyword_after(text: str) -> str | None:
    words = text.strip().split()[:1]
    for word in words:
        if word in TOTAL_KEYWORDS:
            return "total"
        if word in UNIT_PRICE_KEYWORDS:
            return "unit_price"
    return None


def _same_amount(amount: NumberCandidate | None, other: NumberCandidate | None) -> bool:
    if not amount or not other:
        return False
    return abs(amount.value - other.value) < 0.00001


def _has_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    return any(re.search(rf"\b{re.escape(keyword)}\b", text) for keyword in keywords)


def _extract_product_hint(text: str, candidates: list[NumberCandidate]) -> str | None:
    product = text
    for candidate in reversed(candidates):
        product = product[: candidate.start] + " " + product[candidate.end :]
    product = re.sub(
        r"\b(?:soles?|s/|precio|costo|cuesta|vale|unitario|peso|pague|pago|total|monto|cancele|abone|gaste|gasto|kg|kilos?|kilogramos?|gramos?|grs?|gr|g|por|a|en)\b",
        " ",
        product,
    )
    product = re.sub(r"\s+", " ", product).strip(" -,.")
    return product or None


def _category(text: str) -> str:
    return "gasolina" if "gasolina" in text else "general"


def _context_prompt(company_context: dict | None = None) -> str:
    if not company_context:
        return ""
    return (
        "Contexto de empresa:\n"
        f"- Tipo de negocio: {company_context.get('business_type', 'other')}\n"
        f"- Modulos activos: {', '.join(company_context.get('enabled_modules') or [])}\n"
        "Si el modulo inventory esta activo, interpreta mensajes de stock, unidades, kilos, litros y precios por producto. "
        "Si el modulo debts esta activo, detecta deudas por cobrar y por pagar cuando el mensaje mencione debe, debo, deuda o pago de deuda. "
        "Si el modulo production esta activo, clasifica leche, sal, gas, envases e insumos como costos de produccion."
    )


def _normalize_text(text: str) -> str:
    return normalize_text(text)
