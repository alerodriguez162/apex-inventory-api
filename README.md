# Apex Inventory API

Inventory & Order Management API for **Apex Bench — Week 3: Backend Engineering & API Design**.

Courses in focus: *Application Development with Node.js: Managing Advanced Application Elements* and *Designing RESTful Web APIs*.

## Stack

- **Runtime:** Node.js 20+
- **API:** Express + TypeScript
- **Persistence:** SQLite (`better-sqlite3`) in `data/inventory.db`

## Layout

```
src/
  app.ts                 HTTP app (middleware + routers)
  index.ts               Process entry, graceful shutdown
  config.ts              Env-backed settings
  db.ts                  SQLite schema + connection
  services/              Product & inventory domain logic
  validation.ts          Zod schemas + pagination helpers
  errors/                Typed HTTP errors
  middleware/            Request id, logger, 404, 405, errors
  routes/                health, v1, products, inventory, orders
```

## REST conventions

- JSON under `/api/v1` (health stays unversioned at `/api/health`)
- Plural nouns: `/products`, `/inventory`, `/orders`
- Filter with query params — never verbs in the path
- Lists support `?page=` and `?limit=` (default 20, max 100)
- Every response can be correlated with `X-Request-Id`
- Errors: `{ "error", "code", "requestId" }` plus `details` when useful
- Unsupported methods return **405** with an `Allow` header
- Invalid JSON bodies return **400** `INVALID_JSON`

## Daily plan

| Day | Date | Branch | Focus |
|-----|------|--------|--------|
| 1 | 17 Aug | `w3-day-1-scaffold` | API scaffold, health, REST conventions |
| 2 | 18 Aug | `w3-day-2-inventory` | Products + stock (CRUD, filters) |
| 3 | 19 Aug | `w3-day-3-orders` | Orders, line items, stock reservation |
| 4 | 20 Aug | `w3-day-4-quality` | Validation, pagination, idempotency |
| 5 | 21 Aug | `w3-day-5-docs` | OpenAPI, errors, deploy |

Workflow: one branch per day → merge into `main` at end of day.

## API

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/health` | 200 | Liveness, uptime, env |
| GET | `/api/v1` | 200 | Resource map and conventions |
| GET | `/api/v1/products` | 200 | List/filter products (`q`, `sku`, pagination) |
| POST | `/api/v1/products` | 201 | Create product (+ optional `initialStock`) |
| GET | `/api/v1/products/:id` | 200 | Product by id |
| GET | `/api/v1/inventory` | 200 | Stock list (`lowStock`, `threshold`) |
| GET | `/api/v1/inventory/:sku` | 200 | Stock by SKU (`available = quantity - reserved`) |
| PATCH | `/api/v1/inventory/:sku` | 200 | Set `quantity` or apply `delta` |
| GET | `/api/v1/orders` | 200 | List orders (`status`, pagination) |
| POST | `/api/v1/orders` | 201 | Create order and reserve stock |
| GET | `/api/v1/orders/:id` | 200 | Order by id |
| POST | `/api/v1/orders/:id/cancellation` | 200 | Cancel order and release reservation |

## Getting started

```bash
npm install
cp .env.example .env   # optional; PORT=3001 by default
npm run dev            # http://localhost:3001
npm test
```

### Postman

Import `postman/Apex-Inventory-API.postman_collection.json` (File → Import).  
`baseUrl` is already `http://localhost:3001`.
