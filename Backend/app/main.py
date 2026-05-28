from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, dashboard, debts, expenses, inventory, products, reports, sales, settings as settings_routes, telegram, vouchers, workers
from app.core.config import settings
from app.db.session import Base, engine


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)

    api = FastAPI(
        title="SmartConta API",
        description="Multi-tenant SaaS API for Telegram-first business intelligence.",
        version="1.0.0",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api.include_router(auth.router)
    api.include_router(dashboard.router)
    api.include_router(expenses.router)
    api.include_router(sales.router)
    api.include_router(workers.router)
    api.include_router(vouchers.router)
    api.include_router(reports.router)
    api.include_router(settings_routes.router)
    api.include_router(products.router)
    api.include_router(inventory.router)
    api.include_router(debts.router)
    api.include_router(telegram.router)

    @api.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "service": "smartconta"}

    return api


app = create_app()
