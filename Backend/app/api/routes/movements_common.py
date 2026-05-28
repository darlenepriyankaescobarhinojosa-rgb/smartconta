from datetime import date

from sqlalchemy.orm import Session

from app.models import Movement
from app.schemas import MovementCreate


def create_company_movement(db: Session, company_id: int, payload: MovementCreate, source: str = "web") -> Movement:
    movement = Movement(
        company_id=company_id,
        worker_id=payload.worker_id,
        product_id=payload.product_id,
        type=payload.type,
        amount=payload.amount,
        quantity=payload.quantity,
        category=payload.category,
        description=payload.description,
        occurred_on=payload.occurred_on or date.today(),
        source=source,
        ai_confidence=1 if source == "web" else 0,
        raw_text=payload.description,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement

