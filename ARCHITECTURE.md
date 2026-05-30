# SmartConta Architecture

SmartConta is a lightweight ERP for small businesses. The web app is the administrative surface; Telegram is the operational input channel for workers.

## Main Pipeline

```text
Telegram
-> AI Extractor
-> Decision Engine
-> Review Queue when needed
-> Product Resolver
-> transaction_service
-> Stock Service when inventory is confirmed
-> Persistence
```

## Core Responsibilities

- `ai_extractor`: normalizes raw Telegram text and extracts a conservative business event. It must not invent money, quantities, products, or totals.
- `decision_engine`: decides whether the event can create a movement, needs product resolution, can update stock, or must go to review.
- `telegram_review_service`: stores pending review items and prevents duplicate pending review rows for the same raw text.
- `product_resolver`: resolves product hints within one company only. Telegram integration does not create products automatically.
- `transaction_service`: main orchestrator for Telegram and movement creation. It owns `Movement` writes and coordinates product resolution, review queue, and stock effects.
- `stock_service`: only service allowed to calculate and mutate `Product.stock` for operational inventory movements. It records `StockMovement`, validates quantities, supports idempotency keys, and can block negative stock unless a compatibility caller explicitly allows it.
- `price_service`: central service for `ProductPriceHistory` and product cost/price updates. It is not automatically connected to Telegram yet.

## Write Boundaries

| Entity | Write owner |
| --- | --- |
| `Movement` | `transaction_service` |
| `TelegramReviewQueue` | `telegram_review_service` |
| `Product.stock` | `stock_service` |
| `StockMovement` | `stock_service` |
| `ProductPriceHistory` | `price_service` |
| `Product` | product routes and `product_resolver` only when explicitly called with creation enabled |
| `Voucher` | voucher and Telegram photo routes |

## Telegram Safety Rules

- No movement is created before human confirmation when the confirmation flow is active.
- Low confidence or ambiguous events go to review.
- Product ambiguity goes to review.
- Stock is applied only when the event is confirmed, product is resolved, quantity exists, and review is not needed.
- Review approval can create a movement and apply stock once.
- Review rejection never creates a movement.

## Inventory Rules

- `stock_service.apply_stock_movement()` records the stock movement and updates the product stock together.
- Idempotency keys are required for automatic integrations that may be retried.
- Telegram stock updates use `movement:{movement.id}` as idempotency key.
- Web sales now use `stock_service` and `movement:{movement.id}`.
- Temporary compatibility debt: web sales currently allow negative stock because the previous endpoint behavior allowed direct negative stock. This should be tightened in a future explicit phase.

## Current Limits

- OCR is intentionally not part of the active Telegram accounting pipeline.
- Price history is not automatically generated from Telegram yet.
- Product auto-creation from Telegram is disabled.
- Product initial stock can still be set on product creation; strict inventory traceability would require creating products with zero stock and recording an initial stock adjustment in a future phase.
- This architecture stays monolithic by design. No microservices, agents, or embeddings are required for the current ERP base.
