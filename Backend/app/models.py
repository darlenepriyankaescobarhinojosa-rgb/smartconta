import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"


class WorkerStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    disabled = "disabled"


class MovementType(str, enum.Enum):
    sale = "sale"
    expense = "expense"
    stock = "stock"


class VoucherStatus(str, enum.Enum):
    pending = "pending"
    validated = "validated"
    rejected = "rejected"


class BusinessType(str, enum.Enum):
    food_production = "food_production"
    retail = "retail"
    distribution = "distribution"
    services = "services"
    other = "other"


class StockMovementType(str, enum.Enum):
    entry = "entry"
    sale = "sale"
    adjustment = "adjustment"
    loss = "loss"


class DebtType(str, enum.Enum):
    receivable = "receivable"
    payable = "payable"


class DebtStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(120))
    business_type: Mapped[BusinessType] = mapped_column(Enum(BusinessType), default=BusinessType.other)
    enabled_modules: Mapped[list[str]] = mapped_column(JSON, default=list)
    currency: Mapped[str] = mapped_column(String(8), default="PEN")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="company")
    workers: Mapped[list["Worker"]] = relationship(back_populates="company")
    products: Mapped[list["Product"]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.owner)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="users")


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    telegram_user_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    invite_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[WorkerStatus] = mapped_column(Enum(WorkerStatus), default=WorkerStatus.invited)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="workers")
    movements: Mapped[list["Movement"]] = relationship(back_populates="worker")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(80))
    category: Mapped[str | None] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(40), default="unidad")
    cost: Mapped[float] = mapped_column(Float, default=0)
    price: Mapped[float] = mapped_column(Float, default=0)
    stock: Mapped[float] = mapped_column(Float, default=0)
    min_stock: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="products")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True, nullable=False)
    worker_id: Mapped[int | None] = mapped_column(ForeignKey("workers.id"), index=True)
    type: Mapped[StockMovementType] = mapped_column(Enum(StockMovementType), nullable=False)
    previous_stock: Mapped[float] = mapped_column(Float, default=0)
    new_stock: Mapped[float] = mapped_column(Float, default=0)
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(40), default="unidad")
    reason: Mapped[str | None] = mapped_column(Text)
    occurred_on: Mapped[date] = mapped_column(Date, default=date.today)
    source: Mapped[str] = mapped_column(String(40), default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["Product"] = relationship()


class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True, nullable=False)
    cost: Mapped[float] = mapped_column(Float, default=0)
    price: Mapped[float] = mapped_column(Float, default=0)
    occurred_on: Mapped[date] = mapped_column(Date, default=date.today)
    source: Mapped[str] = mapped_column(String(40), default="web")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["Product"] = relationship()


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    worker_id: Mapped[int | None] = mapped_column(ForeignKey("workers.id"), index=True)
    type: Mapped[DebtType] = mapped_column(Enum(DebtType), nullable=False)
    counterparty: Mapped[str] = mapped_column(String(160), nullable=False)
    original_amount: Mapped[float] = mapped_column(Float, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[DebtStatus] = mapped_column(Enum(DebtStatus), default=DebtStatus.pending)
    due_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DebtPayment(Base):
    __tablename__ = "debt_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    debt_id: Mapped[int] = mapped_column(ForeignKey("debts.id"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0)
    paid_on: Mapped[date] = mapped_column(Date, default=date.today)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    debt: Mapped["Debt"] = relationship()


class Movement(Base):
    __tablename__ = "movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    worker_id: Mapped[int | None] = mapped_column(ForeignKey("workers.id"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), index=True)
    type: Mapped[MovementType] = mapped_column(Enum(MovementType), nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0)
    quantity: Mapped[float | None] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_on: Mapped[date] = mapped_column(Date, default=date.today)
    source: Mapped[str] = mapped_column(String(40), default="web")
    ai_confidence: Mapped[float] = mapped_column(Float, default=0)
    raw_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    worker: Mapped["Worker"] = relationship(back_populates="movements")
    product: Mapped["Product"] = relationship()
    voucher: Mapped["Voucher"] = relationship(back_populates="movement", uselist=False)


class Voucher(Base):
    __tablename__ = "vouchers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    movement_id: Mapped[int | None] = mapped_column(ForeignKey("movements.id"), index=True)
    worker_id: Mapped[int | None] = mapped_column(ForeignKey("workers.id"), index=True)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    ocr_text: Mapped[str | None] = mapped_column(Text)
    detected_amount: Mapped[float | None] = mapped_column(Float)
    status: Mapped[VoucherStatus] = mapped_column(Enum(VoucherStatus), default=VoucherStatus.pending)
    validation_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    movement: Mapped["Movement"] = relationship(back_populates="voucher")
