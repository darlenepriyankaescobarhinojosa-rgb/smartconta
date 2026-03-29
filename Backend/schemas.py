from pydantic import BaseModel

class MovimientoCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: str