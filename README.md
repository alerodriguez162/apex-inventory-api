# Apex Inventory API

Inventory & Order Management API for **Apex Bench — Week 3: Backend Engineering & API Design**.

Courses in focus: *Application Development with Node.js: Managing Advanced Application Elements* and *Designing RESTful Web APIs*.

## Stack

- **Runtime:** Node.js 20+
- **API:** Express + TypeScript
- **Persistence:** SQLite from Day 2 (`better-sqlite3`)

## Layout

```
src/
  app.ts                 HTTP app (middleware + routers)
  index.ts               Process entry, graceful shutdown
  config.ts              Env-backed settings
  errors/app-error.ts    Typed HTTP errors
  middleware/            Request id, logger, 404, 405, 501, errors
  routes/                health, v1 map, resource stubs
```

## REST conventions

- JSON under `/api/v1` (health stays unversioned at `/api/health`)
- Plural nouns: `/products`, `/inventory`, `/orders`
- Filter with query params later — never verbs in the path
- Every response can be correlated with `X-Request-Id`
- Errors: `{ "error", "code", "requestId" }` plus `details` when useful
- Defined-but-unbuilt resources return **501** (not 404)
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

## API (Day 1)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/` | 200 | Pointers to health and the v1 map |
| GET | `/api/health` | 200 | Liveness, uptime, env |
| GET | `/api/v1` | 200 | Resource map and conventions |
| GET, POST | `/api/v1/products` | 501 | Product catalog (Day 2) |
| GET | `/api/v1/products/:id` | 501 | Product by id (Day 2) |
| GET | `/api/v1/inventory` | 501 | Stock list (Day 2) |
| GET, PATCH | `/api/v1/inventory/:sku` | 501 | Stock by SKU (Day 2) |
| GET, POST | `/api/v1/orders` | 501 | Orders (Day 3) |
| GET | `/api/v1/orders/:id` | 501 | Order by id (Day 3) |

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
