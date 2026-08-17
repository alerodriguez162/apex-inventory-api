# Apex Inventory API

Inventory & Order Management API for **Apex Bench — Week 3: Backend Engineering & API Design**.

Courses in focus: *Application Development with Node.js: Managing Advanced Application Elements* and *Designing RESTful Web APIs*.

## Stack

- **Runtime:** Node.js 20+
- **API:** Express + TypeScript
- **Persistence:** SQLite from Day 2 (`better-sqlite3`)

## REST conventions

- JSON over HTTPS-style paths under `/api/v1`
- Plural nouns: `/products`, `/inventory`, `/orders`
- Filter with query params, never verbs in the path
- Errors as `{ "error": "...", "code": "..." }` with the right status
- `GET /api/health` is unversioned (ops)

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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness / service metadata |
| GET | `/api/v1` | Resource map (what the API will expose) |

## Getting started

```bash
npm install
npm run dev   # http://localhost:3001
```

Health check: `GET http://localhost:3001/api/health`
