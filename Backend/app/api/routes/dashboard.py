from sqlalchemy import case, func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Movement, MovementType, Product, User, Voucher, VoucherStatus, Worker, WorkerStatus
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    revenue = (
        db.query(func.coalesce(func.sum(Movement.amount), 0))
        .filter(Movement.company_id == user.company_id, Movement.type == MovementType.sale)
        .scalar()
    )
    expenses = (
        db.query(func.coalesce(func.sum(Movement.amount), 0))
        .filter(Movement.company_id == user.company_id, Movement.type == MovementType.expense)
        .scalar()
    )
    active_workers = (
        db.query(func.count(Worker.id))
        .filter(Worker.company_id == user.company_id, Worker.status == WorkerStatus.active)
        .scalar()
    )
    vouchers_pending = (
        db.query(func.count(Voucher.id))
        .filter(Voucher.company_id == user.company_id, Voucher.status == VoucherStatus.pending)
        .scalar()
    )
    stock_units = db.query(func.coalesce(func.sum(Product.stock), 0)).filter(Product.company_id == user.company_id).scalar()

    month_expr = func.to_char(Movement.occurred_on, "YYYY-MM")
    rows = (
        db.query(
            month_expr.label("month"),
            func.coalesce(func.sum(case((Movement.type == MovementType.sale, Movement.amount), else_=0)), 0).label("revenue"),
            func.coalesce(func.sum(case((Movement.type == MovementType.expense, Movement.amount), else_=0)), 0).label("expenses"),
        )
        .filter(Movement.company_id == user.company_id)
        .group_by(month_expr)
        .order_by(month_expr)
        .limit(12)
        .all()
    )
    day_expr = func.to_char(Movement.occurred_on, "Dy")
    day_order = func.extract("dow", Movement.occurred_on)
    daily_rows = (
        db.query(
            day_expr.label("day"),
            day_order.label("day_order"),
            func.coalesce(func.sum(case((Movement.type == MovementType.sale, Movement.amount), else_=0)), 0).label("revenue"),
            func.coalesce(func.sum(case((Movement.type == MovementType.expense, Movement.amount), else_=0)), 0).label("expenses"),
        )
        .filter(Movement.company_id == user.company_id)
        .group_by(day_expr, day_order)
        .order_by(day_order)
        .all()
    )
    categories = (
        db.query(Movement.category, func.coalesce(func.sum(Movement.amount), 0).label("amount"))
        .filter(Movement.company_id == user.company_id, Movement.type == MovementType.expense)
        .group_by(Movement.category)
        .order_by(func.coalesce(func.sum(Movement.amount), 0).desc())
        .limit(8)
        .all()
    )
    recent = (
        db.query(Movement)
        .filter(Movement.company_id == user.company_id)
        .order_by(Movement.created_at.desc())
        .limit(8)
        .all()
    )

    return {
        "revenue": float(revenue or 0),
        "expenses": float(expenses or 0),
        "profit": float((revenue or 0) - (expenses or 0)),
        "active_workers": int(active_workers or 0),
        "vouchers_pending": int(vouchers_pending or 0),
        "stock_units": float(stock_units or 0),
        "monthly_series": [{"month": r.month, "revenue": float(r.revenue), "expenses": float(r.expenses)} for r in rows],
        "daily_series": [{"day": _day_label(r.day), "revenue": float(r.revenue), "expenses": float(r.expenses)} for r in daily_rows],
        "categories": [{"name": r.category or "Sin categoria", "amount": float(r.amount)} for r in categories],
        "recent_movements": recent,
    }


def _day_label(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.strip().lower()[:3]
    labels = {
        "mon": "Lun",
        "tue": "Mar",
        "wed": "Mie",
        "thu": "Jue",
        "fri": "Vie",
        "sat": "Sab",
        "sun": "Dom",
        "lun": "Lun",
        "mar": "Mar",
        "mie": "Mie",
        "jue": "Jue",
        "vie": "Vie",
        "sab": "Sab",
        "dom": "Dom",
    }
    return labels.get(normalized, value.strip())
