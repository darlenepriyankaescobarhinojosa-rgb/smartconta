from app.models import MovementType
from app.services.decision_engine import build_transaction_decision


def test_decision_rejects_review_event():
    decision = build_transaction_decision(
        {
            "type": MovementType.expense,
            "amount": None,
            "product": "queso",
            "needs_review": True,
            "reason": "no explicit total detected",
        }
    )

    assert decision["create_movement"] is False
    assert decision["resolve_product"] is True
    assert decision["update_stock"] is False
    assert decision["needs_review"] is True


def test_decision_allows_valid_expense_without_stock_side_effects():
    decision = build_transaction_decision(
        {
            "type": MovementType.expense,
            "amount": 120.0,
            "product": "queso",
            "needs_review": False,
        }
    )

    assert decision["create_movement"] is True
    assert decision["resolve_product"] is True
    assert decision["update_stock"] is False
    assert decision["save_price_history"] is False


def test_decision_marks_stock_update_only_when_complete():
    decision = build_transaction_decision(
        {
            "type": MovementType.stock,
            "amount": 0,
            "quantity": 10.0,
            "product": "arroz",
            "needs_review": False,
        }
    )

    assert decision["create_movement"] is True
    assert decision["resolve_product"] is True
    assert decision["update_stock"] is True
