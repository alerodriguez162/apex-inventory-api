import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db.js'
import { AppError } from '../errors/app-error.js'
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderStatus,
  Paginated,
  Pagination,
} from '../types/domain.js'
import {
  fulfillReservedStock,
  getProductBySku,
  releaseReservedStock,
  reserveStock,
} from './products.js'

type OrderRow = {
  id: string
  status: OrderStatus
  total_cents: number
  idempotency_key: string | null
  request_hash: string | null
  created_at: string
  updated_at: string
}

type OrderItemRow = {
  sku: string
  quantity: number
  unit_price_cents: number
}

function mapItems(rows: OrderItemRow[]): OrderItem[] {
  return rows.map((row) => ({
    sku: row.sku,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    lineTotalCents: row.quantity * row.unit_price_cents,
  }))
}

function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    status: row.status,
    items,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function loadOrderItems(orderId: string): OrderItem[] {
  const rows = db
    .prepare(
      `SELECT sku, quantity, unit_price_cents
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    )
    .all(orderId) as OrderItemRow[]

  return mapItems(rows)
}

function getOrderRow(id: string): OrderRow | undefined {
  return db
    .prepare(
      `SELECT id, status, total_cents, idempotency_key, request_hash, created_at, updated_at
       FROM orders WHERE id = ?`,
    )
    .get(id) as OrderRow | undefined
}

export function getOrderById(id: string): Order {
  const row = getOrderRow(id)
  if (!row) {
    throw new AppError(404, 'ORDER_NOT_FOUND', `Order ${id} was not found`)
  }

  return mapOrder(row, loadOrderItems(id))
}

export function findOrderByIdempotencyKey(key: string): OrderRow | null {
  const row = db
    .prepare(
      `SELECT id, status, total_cents, idempotency_key, request_hash, created_at, updated_at
       FROM orders WHERE idempotency_key = ?`,
    )
    .get(key) as OrderRow | undefined

  return row ?? null
}

export function listOrders(
  pagination: Pagination,
  filters: { status?: OrderStatus } = {},
): Paginated<Order> {
  const clauses: string[] = []
  const params: Record<string, string | number> = {}

  if (filters.status) {
    clauses.push('status = @status')
    params.status = filters.status
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM orders ${where}`).get(params) as {
      count: number
    }
  ).count

  const offset = (pagination.page - 1) * pagination.limit
  const rows = db
    .prepare(
      `SELECT id, status, total_cents, idempotency_key, request_hash, created_at, updated_at
       FROM orders
       ${where}
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pagination.limit, offset }) as OrderRow[]

  return {
    data: rows.map((row) => mapOrder(row, loadOrderItems(row.id))),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit) || 1),
    },
  }
}

function mergeLineItems(
  items: CreateOrderInput['items'],
): Array<{ sku: string; quantity: number }> {
  const merged = new Map<string, number>()

  for (const item of items) {
    const sku = item.sku.trim()
    merged.set(sku, (merged.get(sku) ?? 0) + item.quantity)
  }

  return [...merged.entries()].map(([sku, quantity]) => ({ sku, quantity }))
}

export function createOrder(
  input: CreateOrderInput,
  options: { idempotencyKey?: string; requestHash?: string } = {},
): { order: Order; replayed: boolean } {
  if (options.idempotencyKey) {
    const existing = findOrderByIdempotencyKey(options.idempotencyKey)
    if (existing) {
      if (
        options.requestHash &&
        existing.request_hash &&
        existing.request_hash !== options.requestHash
      ) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSE',
          'Idempotency-Key was already used with a different request body',
        )
      }

      return {
        order: mapOrder(existing, loadOrderItems(existing.id)),
        replayed: true,
      }
    }
  }

  const lines = mergeLineItems(input.items)
  const timestamp = nowIso()
  const orderId = `ord_${randomUUID().slice(0, 8)}`

  const create = db.transaction(() => {
    let totalCents = 0
    const priced: Array<{
      sku: string
      quantity: number
      unitPriceCents: number
    }> = []

    for (const line of lines) {
      const product = getProductBySku(line.sku)
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', `No product for SKU ${line.sku}`)
      }

      priced.push({
        sku: product.sku,
        quantity: line.quantity,
        unitPriceCents: product.priceCents,
      })
      totalCents += line.quantity * product.priceCents
    }

    db.prepare(
      `INSERT INTO orders (id, status, total_cents, idempotency_key, request_hash, created_at, updated_at)
       VALUES (@id, 'confirmed', @totalCents, @idempotencyKey, @requestHash, @createdAt, @updatedAt)`,
    ).run({
      id: orderId,
      totalCents,
      idempotencyKey: options.idempotencyKey ?? null,
      requestHash: options.requestHash ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, sku, quantity, unit_price_cents)
       VALUES (@orderId, @sku, @quantity, @unitPriceCents)`,
    )

    for (const line of priced) {
      insertItem.run({
        orderId,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
      })
      reserveStock(line.sku, line.quantity, timestamp)
    }

    return getOrderById(orderId)
  })

  try {
    return { order: create(), replayed: false }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      options.idempotencyKey
    ) {
      const existing = findOrderByIdempotencyKey(options.idempotencyKey)
      if (existing) {
        if (
          options.requestHash &&
          existing.request_hash &&
          existing.request_hash !== options.requestHash
        ) {
          throw new AppError(
            409,
            'IDEMPOTENCY_KEY_REUSE',
            'Idempotency-Key was already used with a different request body',
          )
        }

        return {
          order: mapOrder(existing, loadOrderItems(existing.id)),
          replayed: true,
        }
      }
    }
    throw err
  }
}

export function cancelOrder(id: string): Order {
  const order = getOrderById(id)

  if (order.status === 'cancelled') {
    return order
  }

  if (order.status === 'fulfilled') {
    throw new AppError(409, 'ORDER_NOT_CANCELLABLE', 'Fulfilled orders cannot be cancelled')
  }

  if (order.status !== 'confirmed' && order.status !== 'pending') {
    throw new AppError(409, 'ORDER_NOT_CANCELLABLE', `Cannot cancel order in status ${order.status}`)
  }

  const timestamp = nowIso()

  const cancel = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET status = 'cancelled', updated_at = @updatedAt WHERE id = @id`,
    ).run({ id, updatedAt: timestamp })

    for (const item of order.items) {
      releaseReservedStock(item.sku, item.quantity, timestamp)
    }

    return getOrderById(id)
  })

  return cancel()
}

export function fulfillOrder(id: string): Order {
  const order = getOrderById(id)

  if (order.status === 'fulfilled') {
    return order
  }

  if (order.status !== 'confirmed') {
    throw new AppError(
      409,
      'ORDER_NOT_FULFILLABLE',
      `Only confirmed orders can be fulfilled (current: ${order.status})`,
    )
  }

  const timestamp = nowIso()

  const fulfill = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET status = 'fulfilled', updated_at = @updatedAt WHERE id = @id`,
    ).run({ id, updatedAt: timestamp })

    for (const item of order.items) {
      fulfillReservedStock(item.sku, item.quantity, timestamp)
    }

    return getOrderById(id)
  })

  return fulfill()
}
