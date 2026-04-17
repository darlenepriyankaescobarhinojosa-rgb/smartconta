from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    movimientos = relationship("Movimiento", back_populates="user")
    cajas = relationship("CajaDiaria", back_populates="user")



class Movimiento(Base):
    __tablename__ = "movimientos"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, nullable=False)
    monto = Column(Float, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha = Column(Date, default=datetime.date.today)

    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="movimientos")



class CajaDiaria(Base):
    __tablename__ = "caja_diaria"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    fecha = Column(Date, default=datetime.date.today)

    capital_inicial = Column(Float, nullable=False)
    total_ventas = Column(Float, default=0)
    total_gastos = Column(Float, default=0)

    dinero_final = Column(Float, default=0)
    dinero_real = Column(Float, nullable=True)
    diferencia = Column(Float, nullable=True)

    user = relationship("User", back_populates="cajas")