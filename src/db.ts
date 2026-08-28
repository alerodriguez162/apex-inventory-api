import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveDbPath(): string {
  if (process.env.SQLITE_PATH === ':memory:') {
    return ':memory:'
  }

  if (process.env.SQLITE_PATH) {
    return path.resolve(process.env.SQLITE_PATH)
  }

  if (process.env.NODE_ENV === 'test') {
    return ':memory:'
  }

  // Vercel serverless FS is read-only except /tmp
  if (process.env.VERCEL) {
    return '/tmp/apex-inventory.db'
  }

  const dataDir = path.join(__dirname, '..', 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'inventory.db')
}

const dbPath = resolveDbPath()
export const db = new Database(dbPath)

if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL')
}
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory (
    sku TEXT PRIMARY KEY COLLATE NOCASE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (reserved <= quantity)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'fulfilled')),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    idempotency_key TEXT UNIQUE,
    request_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    sku TEXT NOT NULL COLLATE NOCASE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (sku) REFERENCES products(sku)
  );

  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`)

migrateOrdersStatusConstraint()
migrateInventoryCheck()
migrateReorderPoint()

function migrateOrdersStatusConstraint(): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'`)
    .get() as { sql: string } | undefined

  if (!row?.sql || row.sql.includes("'fulfilled'")) {
    return
  }

  db.exec(`
    BEGIN;
    CREATE TABLE orders__mig (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'fulfilled')),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      idempotency_key TEXT UNIQUE,
      request_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO orders__mig (id, status, total_cents, idempotency_key, request_hash, created_at, updated_at)
    SELECT id, status, total_cents, idempotency_key, request_hash, created_at, updated_at FROM orders;
    DROP TABLE orders;
    ALTER TABLE orders__mig RENAME TO orders;
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    COMMIT;
  `)
}

function migrateInventoryCheck(): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'inventory'`)
    .get() as { sql: string } | undefined

  if (!row?.sql || row.sql.includes('reserved <= quantity')) {
    return
  }

  db.exec(`
    BEGIN;
    CREATE TABLE inventory__mig (
      sku TEXT PRIMARY KEY COLLATE NOCASE,
      quantity INTEGER NOT NULL CHECK (quantity >= 0),
      reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
      reorder_point INTEGER NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE ON UPDATE CASCADE,
      CHECK (reserved <= quantity)
    );
    INSERT INTO inventory__mig (sku, quantity, reserved, reorder_point, updated_at)
    SELECT sku, quantity, reserved, 5, updated_at FROM inventory;
    DROP TABLE inventory;
    ALTER TABLE inventory__mig RENAME TO inventory;
    COMMIT;
  `)
}

function migrateReorderPoint(): void {
  const cols = db.prepare(`PRAGMA table_info(inventory)`).all() as Array<{ name: string }>
  if (cols.some((col) => col.name === 'reorder_point')) {
    return
  }

  db.exec(`ALTER TABLE inventory ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 5`)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function resetDatabase(): void {
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM inventory;
    DELETE FROM products;
  `)
}
