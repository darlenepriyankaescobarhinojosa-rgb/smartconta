from pathlib import Path
import sys

from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import engine


MIGRATION = """
INSERT INTO companies (name, industry, currency)
SELECT 'SmartConta Demo', 'Servicios', 'PEN'
WHERE NOT EXISTS (SELECT 1 FROM companies);

ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(140);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'owner';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_type VARCHAR(40) DEFAULT 'other';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '["sales","expenses","inventory","vouchers"]'::jsonb;

ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(40) DEFAULT 'unidad';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DOUBLE PRECISION DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock DOUBLE PRECISION DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE users
SET company_id = COALESCE(company_id, (SELECT id FROM companies ORDER BY id LIMIT 1)),
    name = COALESCE(name, nombre, 'Administrador'),
    password_hash = COALESCE(password_hash, password),
    role = COALESCE(role, 'owner'),
    is_active = COALESCE(is_active, true),
    created_at = COALESCE(created_at, now());

ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'users_company_id_fkey'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  worker_id INTEGER REFERENCES workers(id),
  type VARCHAR(30) NOT NULL,
  previous_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  new_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit VARCHAR(40) NOT NULL DEFAULT 'unidad',
  reason TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(40) NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_price_history (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(40) NOT NULL DEFAULT 'web',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  worker_id INTEGER REFERENCES workers(id),
  type VARCHAR(30) NOT NULL,
  counterparty VARCHAR(160) NOT NULL,
  original_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  due_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  debt_id INTEGER NOT NULL REFERENCES debts(id),
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_product_date ON stock_movements(company_id, product_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_price_history_company_product_date ON product_price_history(company_id, product_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_debts_company_status ON debts(company_id, status);
"""


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text(MIGRATION))
    print("Legacy schema migrated.")


if __name__ == "__main__":
    main()
