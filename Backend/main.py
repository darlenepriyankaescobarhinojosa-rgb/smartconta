from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import Movimiento, User, CajaDiaria
from schemas import (
    MovimientoCreate, MovimientoResponse,
    UserCreate, UserLogin, UserResponse,
    CajaCreate, CajaResponse, CierreCaja
)
import datetime

from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


app = FastAPI()

Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {"mensaje": "SmartConta API funcionando"}


@app.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):

    existe = db.query(User).filter(User.email == user.email).first()
    if existe:
        return {"error": "El email ya está registrado"}

    nuevo_usuario = User(
        nombre=user.nombre,
        email=user.email,
        password=hash_password(user.password) 
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    usuario = db.query(User).filter(User.email == user.email).first()

    if not usuario or not verify_password(user.password, usuario.password):
        return {"error": "Credenciales incorrectas"}

    return {"mensaje": "Login exitoso", "user_id": usuario.id}


@app.post("/movimientos", response_model=MovimientoResponse)
def crear_movimiento(movimiento: MovimientoCreate, db: Session = Depends(get_db)):

    if movimiento.tipo not in ["ingreso", "gasto"]:
        return {"error": "Tipo inválido"}

    nuevo = Movimiento(
        tipo=movimiento.tipo,
        monto=movimiento.monto,
        descripcion=movimiento.descripcion,
        user_id=movimiento.user_id
    )

    db.add(nuevo)

    
    hoy = datetime.date.today()

    caja = db.query(CajaDiaria).filter(
        CajaDiaria.user_id == movimiento.user_id,
        CajaDiaria.fecha == hoy
    ).first()

    if caja:
        if movimiento.tipo == "ingreso":
            caja.total_ventas += movimiento.monto
        else:
            caja.total_gastos += movimiento.monto

        caja.dinero_final = (
            caja.capital_inicial + caja.total_ventas - caja.total_gastos
        )

    db.commit()
    db.refresh(nuevo)

    return nuevo


@app.get("/movimientos/{user_id}", response_model=list[MovimientoResponse])
def obtener_movimientos(user_id: int, db: Session = Depends(get_db)):
    return db.query(Movimiento).filter(Movimiento.user_id == user_id).all()


@app.put("/movimientos/{id}", response_model=MovimientoResponse)
def actualizar_movimiento(id: int, movimiento: MovimientoCreate, db: Session = Depends(get_db)):
    mov = db.query(Movimiento).filter(Movimiento.id == id).first()

    if not mov:
        return {"error": "No encontrado"}

    mov.tipo = movimiento.tipo
    mov.monto = movimiento.monto
    mov.descripcion = movimiento.descripcion

    db.commit()
    db.refresh(mov)

    return mov


@app.delete("/movimientos/{id}")
def eliminar_movimiento(id: int, db: Session = Depends(get_db)):
    mov = db.query(Movimiento).filter(Movimiento.id == id).first()

    if not mov:
        return {"error": "No encontrado"}

    db.delete(mov)
    db.commit()

    return {"mensaje": "Eliminado"}


@app.get("/resumen/{user_id}")
def resumen(user_id: int, db: Session = Depends(get_db)):
    movimientos = db.query(Movimiento).filter(Movimiento.user_id == user_id).all()

    ingresos = sum(m.monto for m in movimientos if m.tipo == "ingreso")
    gastos = sum(m.monto for m in movimientos if m.tipo == "gasto")

    return {
        "ingresos": ingresos,
        "gastos": gastos,
        "ganancia": ingresos - gastos
    }


@app.post("/caja/iniciar", response_model=CajaResponse)
def iniciar_caja(data: CajaCreate, db: Session = Depends(get_db)):

    hoy = datetime.date.today()

    caja_existente = db.query(CajaDiaria).filter(
        CajaDiaria.user_id == data.user_id,
        CajaDiaria.fecha == hoy
    ).first()

    if caja_existente:
        return {"error": "Ya existe una caja iniciada hoy"}

    caja = CajaDiaria(
        capital_inicial=data.capital_inicial,
        user_id=data.user_id
    )

    db.add(caja)
    db.commit()
    db.refresh(caja)
    return caja


@app.get("/caja/{user_id}", response_model=CajaResponse)
def obtener_caja(user_id: int, db: Session = Depends(get_db)):
    hoy = datetime.date.today()

    caja = db.query(CajaDiaria).filter(
        CajaDiaria.user_id == user_id,
        CajaDiaria.fecha == hoy
    ).first()

    return caja

@app.post("/caja/cerrar/{caja_id}")
def cerrar_caja(caja_id: int, data: CierreCaja, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()

    if not caja:
        return {"error": "Caja no encontrada"}

    caja.dinero_real = data.dinero_real
    caja.diferencia = data.dinero_real - caja.dinero_final

    db.commit()

    return {
        "mensaje": "Caja cerrada",
        "diferencia": caja.diferencia
    }