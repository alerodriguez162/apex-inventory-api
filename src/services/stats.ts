import { db } from '../db.js'
import type { ApiStats, OrderStatus } from '../types/domain.js'

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'cancelled', 'fulfilled']

export function getApiStats(lowStockThreshold = 5): ApiStats {
  const products = (
    db.prepare(`SELECT COUNT(*) AS count FROM products`).get() as { count: number }
  ).count

  const inventory = db
    .prepare(
      `SELECT
         COUNT(*) AS skus,
         COALESCE(SUM(quantity), 0) AS unitsOnHand,
         COALESCE(SUM(reserved), 0) AS unitsReserved,
         COALESCE(SUM(quantity - reserved), 0) AS unitsAvailable,
         COALESCE(SUM(CASE WHEN (quantity - reserved) <= @threshold THEN 1 ELSE 0 END), 0) AS lowStockSkus
       FROM inventory`,
    )
    .get({ threshold: lowStockThreshold }) as {
    skus: number
    unitsOnHand: number
    unitsReserved: number
    unitsAvailable: number
    lowStockSkus: number
  }

  const orderCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >

  const rows = db
    .prepare(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`)
    .all() as Array<{ status: OrderStatus; count: number }>

  for (const row of rows) {
    orderCounts[row.status] = row.count
  }

  return {
    products,
    inventory: {
      skus: inventory.skus,
      unitsOnHand: inventory.unitsOnHand,
      unitsReserved: inventory.unitsReserved,
      unitsAvailable: inventory.unitsAvailable,
      lowStockSkus: inventory.lowStockSkus,
    },
    orders: orderCounts,
  }
}
