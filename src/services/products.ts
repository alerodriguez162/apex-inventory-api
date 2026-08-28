import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db.js'
import { AppError } from '../errors/app-error.js'
import type {
  CreateProductInput,
  InventoryItem,
  Paginated,
  Pagination,
  Product,
  ProductSort,
  RestockAlert,
  UpdateInventoryInput,
  UpdateProductInput,
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
  reorder_point: number
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

function suggestedRestockQty(available: number, reorderPoint: number): number {
  return Math.max(0, reorderPoint * 2 - available)
}

function mapInventory(row: InventoryRow): InventoryItem {
  const available = row.quantity - row.reserved
  return {
    sku: row.sku,
    quantity: row.quantity,
    reserved: row.reserved,
    available,
    reorderPoint: row.reorder_point,
    suggestedRestockQty: suggestedRestockQty(available, row.reorder_point),
    updatedAt: row.updated_at,
  }
}

const SORT_SQL: Record<ProductSort, string> = {
  created_at_desc: 'created_at DESC',
  created_at_asc: 'created_at ASC',
  name_asc: 'name COLLATE NOCASE ASC',
  name_desc: 'name COLLATE NOCASE DESC',
  price_asc: 'price_cents ASC',
  price_desc: 'price_cents DESC',
}

export function listProducts(
  pagination: Pagination,
  filters: { q?: string; sku?: string; sort?: ProductSort } = {},
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
  const orderBy = SORT_SQL[filters.sort ?? 'created_at_desc']
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
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pagination.limit, offset }) as ProductRow[]

  return {
    data: rows.map(mapProduct),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit) || 1),
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
      `INSERT INTO inventory (sku, quantity, reserved, reorder_point, updated_at)
       VALUES (@sku, @quantity, 0, @reorderPoint, @updatedAt)`,
    ).run({
      sku: input.sku.trim(),
      quantity: initialStock,
      reorderPoint: input.reorderPoint ?? 5,
      updatedAt: timestamp,
    })
  })

  insert()
  return getProductById(id)
}

export function updateProduct(id: string, input: UpdateProductInput): Product {
  const current = getProductById(id)
  const timestamp = nowIso()

  db.prepare(
    `UPDATE products
     SET name = @name,
         description = @description,
         price_cents = @priceCents,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id,
    name: input.name?.trim() ?? current.name,
    description:
      input.description === undefined
        ? current.description
        : input.description?.trim() || null,
    priceCents: input.priceCents ?? current.priceCents,
    updatedAt: timestamp,
  })

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
      `SELECT sku, quantity, reserved, reorder_point, updated_at
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
      totalPages: Math.max(1, Math.ceil(total / pagination.limit) || 1),
    },
  }
}

export function getInventoryBySku(sku: string): InventoryItem {
  const row = db
    .prepare(
      `SELECT sku, quantity, reserved, reorder_point, updated_at
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
  input: UpdateInventoryInput,
): InventoryItem {
  const current = getInventoryBySku(sku)
  const stockChanging = input.quantity !== undefined || input.delta !== undefined
  const reorderChanging = input.reorderPoint !== undefined

  if (!stockChanging && !reorderChanging) {
    return current
  }

  const timestamp = nowIso()

  if (!stockChanging && reorderChanging) {
    db.prepare(
      `UPDATE inventory
       SET reorder_point = @reorderPoint,
           updated_at = @updatedAt
       WHERE sku = @sku COLLATE NOCASE`,
    ).run({
      sku,
      reorderPoint: input.reorderPoint,
      updatedAt: timestamp,
    })
    return getInventoryBySku(sku)
  }

  let nextQuantity = current.quantity
  if (input.quantity !== undefined) {
    nextQuantity = input.quantity
  } else if (input.delta !== undefined) {
    nextQuantity = current.quantity + input.delta
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

  const nextReorderPoint = input.reorderPoint ?? current.reorderPoint
  const result = db
    .prepare(
      `UPDATE inventory
       SET quantity = @quantity,
           reorder_point = @reorderPoint,
           updated_at = @updatedAt
       WHERE sku = @sku COLLATE NOCASE AND reserved <= @quantity`,
    )
    .run({
      sku,
      quantity: nextQuantity,
      reorderPoint: nextReorderPoint,
      updatedAt: timestamp,
    })

  if (result.changes === 0) {
    throw new AppError(
      409,
      'STOCK_BELOW_RESERVED',
      `Cannot set quantity below reserved amount (${current.reserved})`,
    )
  }

  return getInventoryBySku(sku)
}

export function listRestockAlerts(pagination: Pagination): Paginated<RestockAlert> {
  const where = '(quantity - reserved) <= reorder_point'
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM inventory WHERE ${where}`).get() as {
      count: number
    }
  ).count

  const offset = (pagination.page - 1) * pagination.limit
  const rows = db
    .prepare(
      `SELECT sku, quantity, reserved, reorder_point, updated_at
       FROM inventory
       WHERE ${where}
       ORDER BY (quantity - reserved) ASC, sku ASC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ limit: pagination.limit, offset }) as InventoryRow[]

  return {
    data: rows.map((row) => ({
      ...mapInventory(row),
      reason: 'at_or_below_reorder_point' as const,
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit) || 1),
    },
  }
}

/** Atomically reserve stock; safe under concurrent writers in the same process. */
export function reserveStock(sku: string, quantity: number, updatedAt: string): void {
  const result = db
    .prepare(
      `UPDATE inventory
       SET reserved = reserved + @quantity, updated_at = @updatedAt
       WHERE sku = @sku COLLATE NOCASE
         AND (quantity - reserved) >= @quantity`,
    )
    .run({ sku, quantity, updatedAt })

  if (result.changes === 0) {
    const stock = getInventoryBySku(sku)
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for SKU ${sku}`, {
      sku,
      requested: quantity,
      available: stock.available,
    })
  }
}

export function releaseReservedStock(
  sku: string,
  quantity: number,
  updatedAt: string,
): void {
  const result = db
    .prepare(
      `UPDATE inventory
       SET reserved = reserved - @quantity, updated_at = @updatedAt
       WHERE sku = @sku COLLATE NOCASE AND reserved >= @quantity`,
    )
    .run({ sku, quantity, updatedAt })

  if (result.changes === 0) {
    throw new AppError(409, 'RESERVATION_MISMATCH', `Cannot release reservation for SKU ${sku}`)
  }
}

/** Convert reserved units into shipped units (quantity and reserved both drop). */
export function fulfillReservedStock(
  sku: string,
  quantity: number,
  updatedAt: string,
): void {
  const result = db
    .prepare(
      `UPDATE inventory
       SET quantity = quantity - @quantity,
           reserved = reserved - @quantity,
           updated_at = @updatedAt
       WHERE sku = @sku COLLATE NOCASE
         AND reserved >= @quantity
         AND quantity >= @quantity`,
    )
    .run({ sku, quantity, updatedAt })

  if (result.changes === 0) {
    throw new AppError(409, 'FULFILLMENT_FAILED', `Cannot fulfill reservation for SKU ${sku}`)
  }
}
