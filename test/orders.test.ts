import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')
const { resetDatabase } = await import('../src/db.js')

async function seedProduct(sku: string, stock: number, priceCents = 1000) {
  await request(app).post('/api/v1/products').send({
    sku,
    name: sku,
    priceCents,
    initialStock: stock,
  })
}

describe('Day 3 orders and stock reservation', () => {
  before(() => {
    resetDatabase()
  })

  afterEach(() => {
    resetDatabase()
  })

  it('creates an order and reserves stock', async () => {
    await seedProduct('TEE-001', 10, 2800)

    const order = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'TEE-001', quantity: 3 }] })

    assert.equal(order.status, 201)
    assert.equal(order.body.status, 'confirmed')
    assert.equal(order.body.totalCents, 8400)
    assert.equal(order.body.items.length, 1)

    const stock = await request(app).get('/api/v1/inventory/TEE-001')
    assert.equal(stock.body.quantity, 10)
    assert.equal(stock.body.reserved, 3)
    assert.equal(stock.body.available, 7)
  })

  it('rejects orders when stock is insufficient', async () => {
    await seedProduct('HAT-001', 2)

    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'HAT-001', quantity: 5 }] })

    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'INSUFFICIENT_STOCK')
  })

  it('cancels an order and releases reserved stock', async () => {
    await seedProduct('BAG-001', 6)

    const created = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'BAG-001', quantity: 2 }] })

    const cancelled = await request(app).post(
      `/api/v1/orders/${created.body.id}/cancellation`,
    )

    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.body.status, 'cancelled')

    const stock = await request(app).get('/api/v1/inventory/BAG-001')
    assert.equal(stock.body.reserved, 0)
    assert.equal(stock.body.available, 6)
  })

  it('lists orders and fetches by id', async () => {
    await seedProduct('MUG-001', 5)

    const created = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'MUG-001', quantity: 1 }] })

    const list = await request(app).get('/api/v1/orders')
    assert.equal(list.status, 200)
    assert.equal(list.body.data.length, 1)

    const one = await request(app).get(`/api/v1/orders/${created.body.id}`)
    assert.equal(one.status, 200)
    assert.equal(one.body.id, created.body.id)
  })
})
