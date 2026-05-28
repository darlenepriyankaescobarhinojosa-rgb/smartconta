from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Company, User, UserRole
from app.schemas import LoginRequest, RegisterRequest, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="El email ya esta registrado")

    company = Company(
        name=payload.company_name,
        industry=payload.industry,
        business_type=payload.business_type,
        enabled_modules=payload.enabled_modules,
    )
    db.add(company)
    db.flush()

    user = User(
        company_id=company.id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.owner,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user = db.query(User).options(joinedload(User.company)).filter(User.id == user.id).one()
    token = create_access_token(str(user.id), {"company_id": user.company_id, "role": user.role.value})
    return {"access_token": token, "user": user}


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).options(joinedload(User.company)).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token = create_access_token(str(user.id), {"company_id": user.company_id, "role": user.role.value})
    return {"access_token": token, "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
