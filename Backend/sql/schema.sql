CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  industry VARCHAR(120),
  business_type VARCHAR(40) NOT NULL DEFAULT 'other',
  enabled_modules JSONB NOT NULL DEFAULT '["sales","expenses","inventory","vouchers"]'::jsonb,
  currency VARCHAR(8) NOT NULL DEFAULT 'PEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'owner',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(40),
  telegram_user_id VARCHAR(80) UNIQUE,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80),
  category VARCHAR(120),
  unit VARCHAR(40) NOT NULL DEFAULT 'unidad',
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  worker_id INTEGER REFERENCES workers(id),
  product_id INTEGER REFERENCES products(id),
  type VARCHAR(20) NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  quantity DOUBLE PRECISION,
  category VARCHAR(120),
  description TEXT NOT NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(40) NOT NULL DEFAULT 'web',
  ai_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  movement_id INTEGER REFERENCES movements(id),
  worker_id INTEGER REFERENCES workers(id),
  file_url TEXT NOT NULL,
  ocr_text TEXT,
  detected_amount DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  validation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_company_type_date ON movements(company_id, type, occurred_on);
CREATE INDEX IF NOT EXISTS idx_workers_company_status ON workers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_status ON vouchers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_product_date ON stock_movements(company_id, product_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_price_history_company_product_date ON product_price_history(company_id, product_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_debts_company_status ON debts(company_id, status);
