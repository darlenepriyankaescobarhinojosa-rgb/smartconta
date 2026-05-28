import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User, Worker, WorkerStatus
from app.schemas import WorkerCreate, WorkerOut

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("", response_model=list[WorkerOut])
def list_workers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Worker).filter(Worker.company_id == user.company_id).order_by(Worker.created_at.desc()).all()


@router.post("", response_model=WorkerOut)
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    worker = Worker(
        company_id=user.company_id,
        name=payload.name,
        phone=payload.phone,
        invite_code=secrets.token_urlsafe(8),
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


@router.delete("/{worker_id}")
def delete_worker(worker_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    worker = db.query(Worker).filter(Worker.id == worker_id, Worker.company_id == user.company_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    worker.status = WorkerStatus.disabled
    worker.telegram_user_id = None
    db.commit()
    return {"disabled": True}


@router.post("/{worker_id}/reactivate", response_model=WorkerOut)
def reactivate_worker(worker_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    worker = db.query(Worker).filter(Worker.id == worker_id, Worker.company_id == user.company_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    worker.status = WorkerStatus.invited
    worker.telegram_user_id = None
    worker.invite_code = secrets.token_urlsafe(8)
    db.commit()
    db.refresh(worker)
    return worker
