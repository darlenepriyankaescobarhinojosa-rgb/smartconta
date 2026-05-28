import json
import re

from app.core.config import settings
from app.models import MovementType


SYSTEM_PROMPT = """
Eres el extractor contable de SmartConta. Convierte mensajes de trabajadores en JSON estricto:
type: sale|expense|stock, amount: number, quantity: number|null, category: string|null,
description: string, confidence: number entre 0 y 1.
Usa PEN si el trabajador menciona soles. No inventes montos.
"""


def extract_business_event(text: str, company_context: dict | None = None) -> dict:
    context_prompt = _context_prompt(company_context)
    if settings.openai_api_key:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": f"{SYSTEM_PROMPT}\n{context_prompt}"},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        return _normalize(json.loads(response.choices[0].message.content or "{}"), text)

    return _fallback_extract(text, company_context)


def _fallback_extract(text: str, company_context: dict | None = None) -> dict:
    lowered = text.lower()
    amount = _first_number(lowered)
    quantity = _first_number(lowered) if any(word in lowered for word in ["vendi", "vendí", "entregue", "envié"]) else None

    modules = set((company_context or {}).get("enabled_modules") or [])
    if "inventory" in modules and any(word in lowered for word in ["stock", "inventario", "quedan", "queda"]):
        event_type = MovementType.stock
    elif any(word in lowered for word in ["gaste", "gasté", "pague", "pagué", "compre", "compré"]):
        event_type = MovementType.expense
    elif any(word in lowered for word in ["vendi", "vendí", "cobre", "cobré", "venta"]):
        event_type = MovementType.sale
    else:
        event_type = MovementType.stock

    category = "gasolina" if "gasolina" in lowered else "general"
    return {
        "type": event_type,
        "amount": float(amount or 0),
        "quantity": float(quantity) if quantity is not None and event_type != MovementType.expense else None,
        "category": category,
        "description": text,
        "confidence": 0.62,
    }


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


def _first_number(text: str) -> float | None:
    match = re.search(r"(\d+(?:[.,]\d+)?)", text)
    if not match:
        return None
    return float(match.group(1).replace(",", "."))


def _normalize(data: dict, raw_text: str) -> dict:
    event_type = data.get("type") if data.get("type") in {"sale", "expense", "stock"} else "expense"
    return {
        "type": MovementType(event_type),
        "amount": float(data.get("amount") or 0),
        "quantity": data.get("quantity"),
        "category": data.get("category"),
        "description": data.get("description") or raw_text,
        "confidence": float(data.get("confidence") or 0.8),
    }
