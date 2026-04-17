from pydantic import BaseModel
from typing import Optional
import datetime


class UserCreate(BaseModel):
    nombre: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    nombre: str
    email: str

    class Config:
        from_attributes = True



class MovimientoCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: Optional[str] = None
    user_id: int

class MovimientoResponse(BaseModel):
    id: int
    tipo: str
    monto: float
    descripcion: Optional[str]
    fecha: datetime.date
    user_id: int

    class Config:
        from_attributes = True


class CajaCreate(BaseModel):
    capital_inicial: float
    user_id: int

class CierreCaja(BaseModel):
    dinero_real: float

class CajaResponse(BaseModel):
    id: int
    user_id: int
    fecha: datetime.date

    capital_inicial: float
    total_ventas: float
    total_gastos: float

    dinero_final: float
    dinero_real: Optional[float]
    diferencia: Optional[float]

    class Config:
        from_attributes = True