from app.models import MovementType
from app.services.ai_extractor import extract_business_event, hybrid_parse_amounts, normalize_text
from app.services.transaction_service import persist_validated_telegram_event


def test_hybrid_parser_detects_total_amount_after_pague():
    parsed = hybrid_parse_amounts("Queso de cabra costo 17 soles kilos peso 4.88 gramos pague 83 soles")

    assert parsed["total_amount"] == 83.0
    assert parsed["unit_price"] == 17.0
    assert parsed["weight"] == 4.88
    assert parsed["confidence"] >= 0.9


def test_hybrid_parser_detects_total_amount_before_pague():
    parsed = hybrid_parse_amounts("Queso dambo 15 kg 15 gramos precio 21 soles 318.10 pague")

    assert parsed["total_amount"] == 318.10
    assert parsed["unit_price"] == 21.0
    assert parsed["weight"] == 15.0
    assert parsed["confidence"] >= 0.9


def test_fallback_event_uses_total_not_weight_or_unit_price():
    event = extract_business_event(
        "Queso paria puno 21 soles kilos peso 5 kg 740 gramos pague 120.50",
        {"enabled_modules": ["expenses", "inventory"]},
    )

    assert event["type"] == MovementType.expense
    assert event["amount"] == 120.50
    assert event["confidence"] >= 0.9
    assert event["needs_review"] is False


def test_normalizes_common_dirty_words_and_compact_units():
    normalized = normalize_text("qso dambo 15kg 15 gr precio 21 sles pag 318.10")

    assert normalized == "queso dambo 15 kg 15 gramos precio 21 soles pague 318.10"


def test_dirty_text_detects_total_after_abbreviated_pago():
    event = extract_business_event(
        "qso dambo 15kg 15 gr precio 21 sles pag 318.10",
        {"enabled_modules": ["expenses", "inventory"]},
    )

    assert event["amount"] == 318.10
    assert event["needs_review"] is False


def test_expense_single_number_with_expense_marker_is_total():
    event = extract_business_event("gaste 1780 a san fernando", {"enabled_modules": ["expenses", "inventory"]})

    assert event["type"] == MovementType.expense
    assert event["amount"] == 1780.0
    assert event["needs_review"] is False


def test_unit_price_without_explicit_total_needs_review():
    event = extract_business_event("queso dambo 15 kg precio 21 soles", {"enabled_modules": ["expenses", "inventory"]})

    assert event["amount"] is None
    assert event["needs_review"] is True
    assert event["confidence"] == 0.2
    assert event["reason"] == "no explicit total detected"


def test_weight_only_message_needs_review():
    event = extract_business_event("5 kg 740 gramos", {"enabled_modules": ["expenses", "inventory"]})

    assert event["type"] == MovementType.stock
    assert event["amount"] is None
    assert event["needs_review"] is True


def test_stock_entry_does_not_invent_amount():
    event = extract_business_event("ingreso 10 kg queso", {"enabled_modules": ["expenses", "inventory"]})

    assert event["type"] == MovementType.stock
    assert event["amount"] is None
    assert event["quantity"] == 10.0
    assert event["needs_review"] is True


def test_transaction_service_refuses_needs_review_without_touching_db():
    event = extract_business_event("queso 15 kg precio 21 soles", {"enabled_modules": ["expenses", "inventory"]})

    assert persist_validated_telegram_event(None, None, event, "queso 15 kg precio 21 soles") is None


def test_abbreviated_payment_marker_is_explicit_total():
    event = extract_business_event("pag 120", {"enabled_modules": ["expenses", "inventory"]})

    assert event["amount"] == 120.0
    assert event["needs_review"] is False
