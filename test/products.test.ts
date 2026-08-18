import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')
const { resetDatabase } = await import('../src/db.js')

describe('Day 2 products and inventory', () => {
  before(() => {
    resetDatabase()
  })

  afterEach(() => {
    resetDatabase()
  })

  it('creates a product and seeds inventory', async () => {
    const res = await request(app).post('/api/v1/products').send({
      sku: 'TEE-001',
      name: 'Coast tee',
      priceCents: 2800,
      initialStock: 25,
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.sku, 'TEE-001')
    assert.ok(res.body.id.startsWith('prod_'))

    const stock = await request(app).get('/api/v1/inventory/TEE-001')
    assert.equal(stock.status, 200)
    assert.equal(stock.body.quantity, 25)
    assert.equal(stock.body.available, 25)
  })

  it('lists and filters products', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'HAT-001',
      name: 'Sun hat',
      priceCents: 1800,
      initialStock: 10,
    })
    await request(app).post('/api/v1/products').send({
      sku: 'BAG-001',
      name: 'Beach bag',
      priceCents: 4200,
      initialStock: 4,
    })

    const list = await request(app).get('/api/v1/products?q=hat')
    assert.equal(list.status, 200)
    assert.equal(list.body.data.length, 1)
    assert.equal(list.body.data[0].sku, 'HAT-001')
    assert.equal(list.body.pagination.total, 1)
  })

  it('rejects duplicate SKUs', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'DUP-001',
      name: 'One',
      priceCents: 100,
    })

    const res = await request(app).post('/api/v1/products').send({
      sku: 'dup-001',
      name: 'Two',
      priceCents: 200,
    })

    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'SKU_CONFLICT')
  })

  it('adjusts inventory with delta and absolute quantity', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'MUG-001',
      name: 'Mug',
      priceCents: 1200,
      initialStock: 8,
    })

    const delta = await request(app)
      .patch('/api/v1/inventory/MUG-001')
      .send({ delta: -3 })
    assert.equal(delta.status, 200)
    assert.equal(delta.body.quantity, 5)

    const absolute = await request(app)
      .patch('/api/v1/inventory/MUG-001')
      .send({ quantity: 12 })
    assert.equal(absolute.status, 200)
    assert.equal(absolute.body.quantity, 12)
  })

  it('filters low stock inventory', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'LOW-001',
      name: 'Low',
      priceCents: 500,
      initialStock: 2,
    })
    await request(app).post('/api/v1/products').send({
      sku: 'OK-001',
      name: 'Ok',
      priceCents: 500,
      initialStock: 40,
    })

    const res = await request(app).get('/api/v1/inventory?lowStock=true&threshold=5')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.length, 1)
    assert.equal(res.body.data[0].sku, 'LOW-001')
  })

  it('validates product payloads', async () => {
    const res = await request(app).post('/api/v1/products').send({
      sku: '',
      name: 'Bad',
      priceCents: -1,
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})
