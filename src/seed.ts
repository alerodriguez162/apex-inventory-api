import { createProduct, getProductBySku } from './services/products.js'

const seed = [
  {
    sku: 'TEE-001',
    name: 'Coast tee',
    description: 'Soft cotton tee',
    priceCents: 2800,
    initialStock: 40,
  },
  {
    sku: 'HAT-001',
    name: 'Sun hat',
    description: 'Wide brim',
    priceCents: 1800,
    initialStock: 18,
  },
  {
    sku: 'BAG-001',
    name: 'Beach bag',
    description: 'Canvas tote',
    priceCents: 4200,
    initialStock: 12,
  },
]

export function seedDemoCatalog(): { created: string[]; skipped: string[] } {
  const created: string[] = []
  const skipped: string[] = []

  for (const item of seed) {
    if (getProductBySku(item.sku)) {
      skipped.push(item.sku)
      continue
    }
    createProduct(item)
    created.push(item.sku)
  }

  return { created, skipped }
}
