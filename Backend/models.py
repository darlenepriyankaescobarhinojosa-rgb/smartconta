from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from database import Base
import datetime
from sqlalchemy import ForeignKey
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)

class Movimiento(Base):
    __tablename__ = "movimientos"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String)
    monto = Column(Float)
    descripcion = Column(String)
    fecha = Column(Date, default=datetime.date.today)

    user_id = Column(Integer, ForeignKey("users.id")) 