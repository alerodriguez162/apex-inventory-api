export type Product = {
  id: string
  sku: string
  name: string
  description: string | null
  priceCents: number
  createdAt: string
  updatedAt: string
}

export type InventoryItem = {
  sku: string
  quantity: number
  reserved: number
  available: number
  updatedAt: string
}

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'fulfilled'

export type OrderItem = {
  sku: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export type Order = {
  id: string
  status: OrderStatus
  items: OrderItem[]
  totalCents: number
  createdAt: string
  updatedAt: string
}

export type CreateProductInput = {
  sku: string
  name: string
  description?: string | null
  priceCents: number
  initialStock?: number
}

export type UpdateProductInput = {
  name?: string
  description?: string | null
  priceCents?: number
}

export type UpdateInventoryInput = {
  quantity?: number
  delta?: number
}

export type CreateOrderInput = {
  items: Array<{ sku: string; quantity: number }>
}

export type ProductSort =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'

export type Pagination = {
  page: number
  limit: number
}

export type Paginated<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type ApiStats = {
  products: number
  inventory: {
    skus: number
    unitsOnHand: number
    unitsReserved: number
    unitsAvailable: number
    lowStockSkus: number
  }
  orders: Record<OrderStatus, number>
}
