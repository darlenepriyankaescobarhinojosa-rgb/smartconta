from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field

from app.models import BusinessType, DebtStatus, DebtType, MovementType, StockMovementType, TelegramReviewStatus, UserRole, VoucherStatus, WorkerStatus


DEFAULT_MODULES = ["sales", "expenses", "inventory", "vouchers"]


class CompanyOut(BaseModel):
    id: int
    name: str
    industry: str | None = None
    business_type: BusinessType = BusinessType.other
    enabled_modules: list[str] = Field(default_factory=lambda: DEFAULT_MODULES.copy())
    currency: str

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    industry: str | None = None
    business_type: BusinessType = BusinessType.other
    enabled_modules: list[str] = Field(default_factory=lambda: DEFAULT_MODULES.copy())
    name: str = Field(min_length=2, max_length=140)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    company_id: int
    name: str
    email: EmailStr
    role: UserRole
    company: CompanyOut

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class WorkerCreate(BaseModel):
    name: str
    phone: str | None = None


class WorkerOut(BaseModel):
    id: int
    company_id: int
    name: str
    phone: str | None = None
    telegram_user_id: str | None = None
    invite_code: str
    status: WorkerStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str = "unidad"
    cost: float = 0
    price: float = 0
    stock: float = 0
    min_stock: float = 0


class ProductOut(ProductCreate):
    id: int
    company_id: int
    is_active: bool

    class Config:
        from_attributes = True


class StockMovementCreate(BaseModel):
    product_id: int
    type: StockMovementType
    quantity: float
    new_stock: float | None = None
    reason: str | None = None
    occurred_on: date | None = None


class StockMovementOut(BaseModel):
    id: int
    company_id: int
    product_id: int
    worker_id: int | None = None
    type: StockMovementType
    previous_stock: float
    new_stock: float
    quantity: float
    unit: str
    reason: str | None
    occurred_on: date
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductPriceHistoryCreate(BaseModel):
    product_id: int
    cost: float = 0
    price: float = 0
    occurred_on: date | None = None
    notes: str | None = None


class ProductPriceHistoryOut(BaseModel):
    id: int
    company_id: int
    product_id: int
    cost: float
    price: float
    occurred_on: date
    source: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DebtCreate(BaseModel):
    type: DebtType
    counterparty: str
    original_amount: float
    due_on: date | None = None
    notes: str | None = None


class DebtOut(BaseModel):
    id: int
    company_id: int
    type: DebtType
    counterparty: str
    original_amount: float
    balance: float
    status: DebtStatus
    due_on: date | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DebtPaymentCreate(BaseModel):
    amount: float
    paid_on: date | None = None
    notes: str | None = None


class MovementCreate(BaseModel):
    type: MovementType
    amount: float = 0
    quantity: float | None = None
    category: str | None = None
    description: str
    occurred_on: date | None = None
    worker_id: int | None = None
    product_id: int | None = None


class MovementOut(BaseModel):
    id: int
    company_id: int
    worker_id: int | None = None
    product_id: int | None = None
    type: MovementType
    amount: float
    quantity: float | None = None
    category: str | None = None
    description: str
    occurred_on: date
    source: str
    ai_confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class VoucherCreate(BaseModel):
    file_url: str
    movement_id: int | None = None
    worker_id: int | None = None


class VoucherOut(BaseModel):
    id: int
    company_id: int
    movement_id: int | None
    worker_id: int | None
    file_url: str
    ocr_text: str | None
    detected_amount: float | None
    status: VoucherStatus
    validation_notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    revenue: float
    expenses: float
    profit: float
    active_workers: int
    vouchers_pending: int
    stock_units: float
    monthly_series: list[dict]
    daily_series: list[dict]
    categories: list[dict]
    recent_movements: list[MovementOut]


class TelegramMessage(BaseModel):
    telegram_user_id: str
    text: str | None = None
    photo_url: str | None = None
    invite_code: str | None = None


class TelegramReviewQueueOut(BaseModel):
    id: int
    company_id: int
    raw_text: str
    parsed_json: dict
    decision_json: dict
    confidence: float
    status: TelegramReviewStatus
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by_worker_id: int | None = None

    class Config:
        from_attributes = True


class TelegramReviewEditRequest(BaseModel):
    amount: float | None = None
    product: str | None = None
    category: str | None = None


class VisionReviewItemCorrection(BaseModel):
    raw_name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    unit_cost: float | None = None
    line_total: float | None = None


class VisionReviewCorrectionRequest(BaseModel):
    supplier: str | None = None
    date: str | None = None
    total_amount: float | None = None
    currency: str | None = None
    items: list[VisionReviewItemCorrection] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
