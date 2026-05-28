# SmartConta

SmartConta es una plataforma SaaS multiempresa donde los trabajadores reportan ventas, gastos, stock y vouchers desde Telegram. El backend procesa esos mensajes con IA/OCR, los guarda con `company_id` y el administrador ve la operacion en un dashboard web.

## Arquitectura

```text
Trabajador -> Telegram Bot -> FastAPI Webhook -> IA/OCR -> PostgreSQL -> Dashboard React
```

Componentes:

- `Fronted/`: dashboard React, TailwindCSS, React Router, Axios, Recharts.
- `Backend/`: API FastAPI, SQLAlchemy, JWT, modelos multi-tenant, servicios IA/OCR y webhook Telegram.
- `Backend/sql/schema.sql`: esquema PostgreSQL base.
- `docker-compose.yml`: PostgreSQL local para desarrollo.

## Multiempresa

La frontera de seguridad es `company_id`.

- Cada administrador pertenece a una empresa.
- Cada trabajador, producto, movimiento y voucher pertenece a una empresa.
- Los endpoints autenticados obtienen el usuario desde JWT y filtran por `user.company_id`.
- Los trabajadores no usan la web; se asocian con `invite_code` y reportan desde Telegram.

## Ejecucion local

1. Levantar PostgreSQL:

```bash
docker compose up -d postgres
```

2. Backend:

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

3. Frontend:

```bash
cd Fronted
npm install
npm run dev
```

## Variables importantes

- `DATABASE_URL`: conexion PostgreSQL.
- `JWT_SECRET_KEY`: secreto largo y privado para tokens.
- `OPENAI_API_KEY`: activa extraccion IA real. Sin key, el sistema usa extractor local simple.
- `TELEGRAM_BOT_TOKEN`: token del bot.
- `TESSERACT_CMD`: ruta local de Tesseract si se usa OCR local.

## Flujo Telegram

1. Admin crea trabajador en `/workers`.
2. SmartConta genera `invite_code`.
3. Trabajador abre Telegram y envia `/start <invite_code>`.
4. El webhook asocia `telegram_user_id` con el trabajador y su empresa.
5. Mensajes como `Gaste 120 soles en gasolina` se transforman en movimientos.
6. Fotos/vouchers quedan en `/vouchers` con estado de OCR.

## Roadmap MVP

1. Autenticacion, empresas, trabajadores y dashboard.
2. Bot Telegram con asociacion por codigo.
3. Extraccion IA de gastos, ventas y stock.
4. OCR de vouchers y validacion contra montos.
5. Reportes financieros y alertas inteligentes.
6. Facturacion SaaS, roles avanzados, auditoria y permisos.

## Despliegue recomendado

- Frontend: Vercel, Netlify o Cloudflare Pages.
- Backend: Render, Fly.io, Railway, AWS ECS o Google Cloud Run.
- Base de datos: Supabase, Neon, RDS o Cloud SQL.
- Secretos: variables de entorno del proveedor.
- Telegram: configurar webhook HTTPS hacia `/telegram/webhook`.

