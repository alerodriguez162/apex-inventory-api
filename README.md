# Apex Inventory API

Inventory & Order Management API for **Apex Bench — Week 3: Backend Engineering & API Design**.

Courses in focus: *Application Development with Node.js: Managing Advanced Application Elements* and *Designing RESTful Web APIs*.

## Stack

- **Runtime:** Node.js 20+
- **API:** Express + TypeScript
- **Persistence:** SQLite (`better-sqlite3`) in `data/inventory.db`
- **Docs:** OpenAPI 3 + Swagger UI at `/api/docs`

## Layout

```
src/           Express app, routes, services, validation
openapi/       OpenAPI 3 specification
postman/       Postman collection
scripts/       Seed helpers
test/          Node.js test runner suites
```

## REST conventions

- JSON under `/api/v1` (health unversioned at `/api/health`)
- Plural nouns, no verbs in paths
- Lists: `?page=` + `?limit=` plus `X-Total-Count` / `Link` headers
- Errors: `{ error, code, requestId }` (+ `details` when useful)
- Orders accept optional `Idempotency-Key` (8–128 chars)

## Daily plan

| Day | Date | Branch | Focus |
|-----|------|--------|--------|
| 1 | 17 Aug | `w3-day-1-scaffold` | API scaffold, health, REST conventions |
| 2 | 18 Aug | `w3-day-2-inventory` | Products + stock (CRUD, filters) |
| 3 | 19 Aug | `w3-day-3-orders` | Orders, line items, stock reservation |
| 4 | 20 Aug | `w3-day-4-quality` | Validation, pagination, idempotency |
| 5 | 21 Aug | `w3-day-5-docs` | OpenAPI, seed, Docker, polish |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/docs/openapi.json` | OpenAPI document |
| GET/POST | `/api/v1/products` | Catalog (`q`, `sku`, `sort`, pagination) |
| GET/PATCH | `/api/v1/products/:id` | Product by id / update fields |
| GET | `/api/v1/inventory` | Stock list (`lowStock`) |
| GET/PATCH | `/api/v1/inventory/:sku` | Stock by SKU |
| GET/POST | `/api/v1/orders` | Orders (+ atomic reserve) |
| GET | `/api/v1/orders/:id` | Order by id |
| POST | `/api/v1/orders/:id/cancellation` | Cancel + release reservation |
| POST | `/api/v1/orders/:id/fulfillment` | Fulfill + deduct on-hand stock |
| GET | `/api/v1/stats` | Aggregate catalog / stock / order counts |

### Order lifecycle

`confirmed` (on create, stock reserved) → `fulfilled` (stock deducted) **or** `cancelled` (reservation released).

### Hardening

- Atomic `UPDATE … WHERE (quantity - reserved) >= n` for reservations
- Gzip compression + Helmet + rate limit (disabled in tests)
- `Location` header on `201` creates
- Zod moved to runtime dependencies

## Getting started

```bash
npm install
cp .env.example .env
npm run seed          # optional demo SKUs
npm run dev           # http://localhost:3001
npm test
```

- Health: http://localhost:3001/api/health  
- Docs: http://localhost:3001/api/docs  
- Postman: import `postman/Apex-Inventory-API.postman_collection.json`

## Docker

```bash
docker build -t apex-inventory-api .
docker run --rm -p 3001:3001 -e PORT=3001 apex-inventory-api
```

SQLite file lives inside the container unless you mount a volume on `/app/data`.

## Live

- **Production:** https://apex-inventory-api.vercel.app
- **Docs:** https://apex-inventory-api.vercel.app/api/docs
- **Health:** https://apex-inventory-api.vercel.app/api/health
- **Repo:** https://github.com/alerodriguez162/apex-inventory-api

## Deploy notes

This API uses native SQLite (`better-sqlite3`).

- **Local / Docker:** persistent file under `data/` (or a mounted volume).
- **Vercel:** SQLite lives in `/tmp` (ephemeral per instance). Demo catalog seeds automatically when empty.

```bash
npx vercel --prod
```

Set `PORT` / `CORS_ORIGIN` / `RATE_LIMIT_*` as needed in the Vercel project env.
