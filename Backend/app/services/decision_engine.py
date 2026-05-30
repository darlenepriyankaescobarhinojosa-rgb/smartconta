from app.models import MovementType


def build_transaction_decision(event: dict) -> dict:
    if event.get("needs_review") or event.get("amount") is None:
        return {
            "create_movement": False,
            "resolve_product": bool(event.get("product")),
            "update_stock": False,
            "save_price_history": False,
            "needs_review": True,
            "reason": event.get("reason") or "event requires review",
        }

    event_type = event.get("type")
    event_type_value = getattr(event_type, "value", str(event_type))
    has_product = bool(event.get("product"))
    has_quantity = event.get("quantity") is not None

    return {
        "create_movement": True,
        "resolve_product": has_product,
        "update_stock": event_type == MovementType.stock and has_product and has_quantity,
        "save_price_history": False,
        "needs_review": False,
        "reason": _decision_reason(event_type_value, has_product, has_quantity),
    }


def _decision_reason(event_type: str, has_product: bool, has_quantity: bool) -> str:
    if event_type == "stock" and has_product and has_quantity:
        return "validated stock signal with product and quantity"
    if event_type == "sale":
        return "validated sale with explicit amount"
    if has_product:
        return "validated movement with product hint"
    return "validated movement with explicit amount"
