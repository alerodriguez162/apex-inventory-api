import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')
const { resetDatabase } = await import('../src/db.js')

describe('API improvements', () => {
  before(() => {
    resetDatabase()
  })

  afterEach(() => {
    resetDatabase()
  })

  it('patches a product', async () => {
    const created = await request(app).post('/api/v1/products').send({
      sku: 'TEE-100',
      name: 'Old name',
      priceCents: 2000,
      initialStock: 5,
    })

    const patched = await request(app)
      .patch(`/api/v1/products/${created.body.id}`)
      .send({ name: 'New name', priceCents: 2500 })

    assert.equal(patched.status, 200)
    assert.equal(patched.body.name, 'New name')
    assert.equal(patched.body.priceCents, 2500)
  })

  it('sorts products by price', async () => {
    await request(app)
      .post('/api/v1/products')
      .send({ sku: 'A-1', name: 'Cheap', priceCents: 500, initialStock: 1 })
    await request(app)
      .post('/api/v1/products')
      .send({ sku: 'B-1', name: 'Pricey', priceCents: 9000, initialStock: 1 })

    const res = await request(app).get('/api/v1/products?sort=price_desc')
    assert.equal(res.status, 200)
    assert.equal(res.body.data[0].sku, 'B-1')
    assert.equal(res.body.data[1].sku, 'A-1')
  })

  it('fulfills an order and deducts on-hand stock', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'FUL-001',
      name: 'Fulfill me',
      priceCents: 1000,
      initialStock: 10,
    })

    const order = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'FUL-001', quantity: 4 }] })

    assert.equal(order.status, 201)
    assert.ok(order.headers.location?.includes(order.body.id))

    const reserved = await request(app).get('/api/v1/inventory/FUL-001')
    assert.equal(reserved.body.quantity, 10)
    assert.equal(reserved.body.reserved, 4)
    assert.equal(reserved.body.available, 6)

    const fulfilled = await request(app).post(
      `/api/v1/orders/${order.body.id}/fulfillment`,
    )
    assert.equal(fulfilled.status, 200)
    assert.equal(fulfilled.body.status, 'fulfilled')

    const stock = await request(app).get('/api/v1/inventory/FUL-001')
    assert.equal(stock.body.quantity, 6)
    assert.equal(stock.body.reserved, 0)
    assert.equal(stock.body.available, 6)
  })

  it('rejects cancelling a fulfilled order', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'FUL-002',
      name: 'Done',
      priceCents: 1000,
      initialStock: 5,
    })

    const order = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ sku: 'FUL-002', quantity: 1 }] })

    await request(app).post(`/api/v1/orders/${order.body.id}/fulfillment`)

    const cancel = await request(app).post(
      `/api/v1/orders/${order.body.id}/cancellation`,
    )
    assert.equal(cancel.status, 409)
    assert.equal(cancel.body.code, 'ORDER_NOT_CANCELLABLE')
  })

  it('returns inventory and order stats', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'STAT-1',
      name: 'Stats',
      priceCents: 100,
      initialStock: 2,
    })

    const res = await request(app).get('/api/v1/stats')
    assert.equal(res.status, 200)
    assert.equal(res.body.products, 1)
    assert.equal(res.body.inventory.skus, 1)
    assert.equal(res.body.inventory.lowStockSkus, 1)
    assert.equal(res.body.inventory.restockAlerts, 1)
    assert.equal(res.body.orders.confirmed, 0)
  })
})
