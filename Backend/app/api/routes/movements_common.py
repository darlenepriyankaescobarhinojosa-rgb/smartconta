from sqlalchemy.orm import Session

from app.models import Movement
from app.schemas import MovementCreate
from app.services.transaction_service import create_company_movement as create_validated_company_movement


def create_company_movement(db: Session, company_id: int, payload: MovementCreate, source: str = "web") -> Movement:
    return create_validated_company_movement(db, company_id, payload, source)
