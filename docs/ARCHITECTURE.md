# Arquitectura profesional SmartConta

## Vision de producto

SmartConta convierte conversaciones operativas en datos empresariales. La web es para administradores; Telegram es la interfaz diaria para trabajadores.

## Dominios principales

- Empresas: tenant principal.
- Usuarios: administradores con email/password y JWT.
- Trabajadores: personas operativas asociadas a Telegram.
- Movimientos: ventas, gastos y stock.
- Productos: inventario y precios.
- Vouchers: imagenes con OCR y validacion.
- Reportes: agregaciones financieras por empresa.

## Modelo multi-tenant

Todas las tablas operativas incluyen `company_id`. La API no acepta `company_id` desde el cliente para operaciones sensibles; lo toma del usuario autenticado o del trabajador asociado a Telegram.

Regla de oro:

```text
WHERE resource.company_id = current_user.company_id
```

Para Telegram:

```text
telegram_user_id -> worker -> company_id -> movement/voucher
```

## IA

Entrada:

```text
"Gaste 120 soles en gasolina"
```

Salida esperada:

```json
{
  "type": "expense",
  "amount": 120,
  "quantity": null,
  "category": "gasolina",
  "description": "Gaste 120 soles en gasolina",
  "confidence": 0.91
}
```

El servicio `app/services/ai_extractor.py` usa OpenAI si `OPENAI_API_KEY` existe. Si no existe, usa un fallback local para desarrollo.

## OCR

`app/services/ocr.py` es el adaptador unico para OCR. En produccion debe:

1. Descargar el archivo de Telegram.
2. Enviarlo a Tesseract o Google Vision.
3. Extraer texto, RUC, fecha, monto total y moneda.
4. Comparar el monto detectado contra el movimiento asociado.
5. Marcar `validated`, `pending` o `rejected`.

## Seguridad

- JWT con expiracion.
- Passwords con bcrypt.
- CORS configurable.
- `company_id` nunca se confia desde el frontend.
- Webhook Telegram debe validarse con secreto en produccion.
- Auditoria recomendada: guardar request original, usuario, IP y cambios.

## Escalabilidad SaaS

Fase MVP:

- Una base PostgreSQL compartida.
- `company_id` e indices compuestos.
- Background jobs simples para OCR.

Fase crecimiento:

- Cola Redis/RQ, Celery o Dramatiq para IA/OCR.
- Rate limits por empresa.
- Billing por empresa.
- Row Level Security en PostgreSQL.
- Observabilidad con OpenTelemetry y logs estructurados.

Fase enterprise:

- Particionado por tenant grande.
- Cifrado por empresa para datos sensibles.
- SSO/SAML.
- Exportaciones contables por pais.

