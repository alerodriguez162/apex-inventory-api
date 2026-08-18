import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db.js'
import { AppError } from '../errors/app-error.js'
import type {
  CreateProductInput,
  InventoryItem,
  Paginated,
  Pagination,
  Product,
} from '../types/domain.js'

type ProductRow = {
  id: string
  sku: string
  name: string
  description: string | null
  price_cents: number
  created_at: string
  updated_at: string
}

type InventoryRow = {
  sku: string
  quantity: number
  reserved: number
  updated_at: string
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapInventory(row: InventoryRow): InventoryItem {
  return {
    sku: row.sku,
    quantity: row.quantity,
    reserved: row.reserved,
    available: row.quantity - row.reserved,
    updatedAt: row.updated_at,
  }
}

export function listProducts(
  pagination: Pagination,
  filters: { q?: string; sku?: string } = {},
): Paginated<Product> {
  const clauses: string[] = []
  const params: Record<string, string | number> = {}

  if (filters.sku) {
    clauses.push('sku = @sku COLLATE NOCASE')
    params.sku = filters.sku
  }

  if (filters.q) {
    clauses.push("(name LIKE @q OR sku LIKE @q OR IFNULL(description, '') LIKE @q)")
    params.q = `%${filters.q}%`
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM products ${where}`).get(params) as {
      count: number
    }
  ).count

  const offset = (pagination.page - 1) * pagination.limit
  const rows = db
    .prepare(
      `SELECT id, sku, name, description, price_cents, created_at, updated_at
       FROM products
       ${where}
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pagination.limit, offset }) as ProductRow[]

  return {
    data: rows.map(mapProduct),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  }
}

export function getProductById(id: string): Product {
  const row = db
    .prepare(
      `SELECT id, sku, name, description, price_cents, created_at, updated_at
       FROM products WHERE id = ?`,
    )
    .get(id) as ProductRow | undefined

  if (!row) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${id} was not found`)
  }

  return mapProduct(row)
}

export function getProductBySku(sku: string): Product | null {
  const row = db
    .prepare(
      `SELECT id, sku, name, description, price_cents, created_at, updated_at
       FROM products WHERE sku = ? COLLATE NOCASE`,
    )
    .get(sku) as ProductRow | undefined

  return row ? mapProduct(row) : null
}

export function createProduct(input: CreateProductInput): Product {
  const existing = getProductBySku(input.sku)
  if (existing) {
    throw new AppError(409, 'SKU_CONFLICT', `SKU ${input.sku} already exists`)
  }

  const id = `prod_${randomUUID().slice(0, 8)}`
  const timestamp = nowIso()
  const initialStock = input.initialStock ?? 0

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO products (id, sku, name, description, price_cents, created_at, updated_at)
       VALUES (@id, @sku, @name, @description, @priceCents, @createdAt, @updatedAt)`,
    ).run({
      id,
      sku: input.sku.trim(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceCents: input.priceCents,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    db.prepare(
      `INSERT INTO inventory (sku, quantity, reserved, updated_at)
       VALUES (@sku, @quantity, 0, @updatedAt)`,
    ).run({
      sku: input.sku.trim(),
      quantity: initialStock,
      updatedAt: timestamp,
    })
  })

  insert()
  return getProductById(id)
}

export function listInventory(
  pagination: Pagination,
  filters: { lowStock?: boolean; threshold?: number } = {},
): Paginated<InventoryItem> {
  const threshold = filters.threshold ?? 5
  const clauses: string[] = []
  const params: Record<string, number> = {}

  if (filters.lowStock) {
    clauses.push('(quantity - reserved) <= @threshold')
    params.threshold = threshold
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM inventory ${where}`).get(params) as {
      count: number
    }
  ).count

  const offset = (pagination.page - 1) * pagination.limit
  const rows = db
    .prepare(
      `SELECT sku, quantity, reserved, updated_at
       FROM inventory
       ${where}
       ORDER BY sku ASC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pagination.limit, offset }) as InventoryRow[]

  return {
    data: rows.map(mapInventory),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  }
}

export function getInventoryBySku(sku: string): InventoryItem {
  const row = db
    .prepare(
      `SELECT sku, quantity, reserved, updated_at
       FROM inventory WHERE sku = ? COLLATE NOCASE`,
    )
    .get(sku) as InventoryRow | undefined

  if (!row) {
    throw new AppError(404, 'INVENTORY_NOT_FOUND', `No inventory for SKU ${sku}`)
  }

  return mapInventory(row)
}

export function updateInventory(
  sku: string,
  input: { quantity?: number; delta?: number },
): InventoryItem {
  const current = getInventoryBySku(sku)
  let nextQuantity = current.quantity

  if (input.quantity !== undefined) {
    nextQuantity = input.quantity
  } else if (input.delta !== undefined) {
    nextQuantity = current.quantity + input.delta
  } else {
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide quantity or delta')
  }

  if (nextQuantity < 0) {
    throw new AppError(400, 'INVALID_STOCK', 'Stock quantity cannot be negative')
  }

  if (nextQuantity < current.reserved) {
    throw new AppError(
      409,
      'STOCK_BELOW_RESERVED',
      `Cannot set quantity below reserved amount (${current.reserved})`,
    )
  }

  const timestamp = nowIso()
  db.prepare(
    `UPDATE inventory SET quantity = @quantity, updated_at = @updatedAt
     WHERE sku = @sku COLLATE NOCASE`,
  ).run({ sku, quantity: nextQuantity, updatedAt: timestamp })

  return getInventoryBySku(sku)
}
