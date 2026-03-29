from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import Movimiento
from schemas import MovimientoCreate
from models import User
from schemas import UserCreate, UserLogin
app = FastAPI()

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"mensaje": "SmartConta API funcionando "}
@app.post("/movimientos")
def crear_movimiento(movimiento: MovimientoCreate, db: Session = Depends(get_db)):
    nuevo = Movimiento(
        tipo=movimiento.tipo,
        monto=movimiento.monto,
        descripcion=movimiento.descripcion,
        user_id=movimiento.user_id
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/movimientos/{user_id}")
def obtener_movimientos(user_id: int, db: Session = Depends(get_db)):
    return db.query(Movimiento).filter(Movimiento.user_id == user_id).all()
@app.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    movimientos = db.query(Movimiento).all()

    ingresos = sum(m.monto for m in movimientos if m.tipo == "ingreso")
    gastos = sum(m.monto for m in movimientos if m.tipo == "gasto")

    return {
        "ingresos": ingresos,
        "gastos": gastos,
        "ganancia": ingresos - gastos
    }

@app.put("/movimientos/{id}")
def actualizar_movimiento(id: int, movimiento: MovimientoCreate, db: Session = Depends(get_db)):
    mov = db.query(Movimiento).filter(Movimiento.id == id).first()

    if not mov:
        return {"error": "No encontrado"}

    mov.tipo = movimiento.tipo
    mov.monto = movimiento.monto
    mov.descripcion = movimiento.descripcion

    db.commit()
    return mov

@app.delete("/movimientos/{id}")
def eliminar_movimiento(id: int, db: Session = Depends(get_db)):
    mov = db.query(Movimiento).filter(Movimiento.id == id).first()

    if not mov:
        return {"error": "No encontrado"}

    db.delete(mov)
    db.commit()

    return {"mensaje": "Eliminado"}

@app.get("/movimientos/tipo/{tipo}")
def filtrar(tipo: str, db: Session = Depends(get_db)):
    return db.query(Movimiento).filter(Movimiento.tipo == tipo).all()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permite React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    nuevo_usuario = User(
        nombre=user.nombre,
        email=user.email,
        password=user.password
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    usuario = db.query(User).filter(User.email == user.email).first()

    if not usuario or usuario.password != user.password:
        return {"error": "Credenciales incorrectas"}

    return {"mensaje": "Login exitoso", "user_id": usuario.id}