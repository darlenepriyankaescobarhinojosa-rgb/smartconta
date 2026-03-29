from pydantic import BaseModel

class MovimientoCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: str
    user_id: int


class UserCreate(BaseModel):
    nombre: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str