import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')
const { resetDatabase } = await import('../src/db.js')

describe('Restock alerts', () => {
  before(() => {
    resetDatabase()
  })

  afterEach(() => {
    resetDatabase()
  })

  it('uses a default reorder point of 5 and suggests a restock quantity', async () => {
    const created = await request(app).post('/api/v1/products').send({
      sku: 'LOW-STOCK',
      name: 'Almost gone',
      priceCents: 900,
      initialStock: 3,
    })
    assert.equal(created.status, 201)

    const stock = await request(app).get('/api/v1/inventory/LOW-STOCK')
    assert.equal(stock.status, 200)
    assert.equal(stock.body.reorderPoint, 5)
    assert.equal(stock.body.available, 3)
    assert.equal(stock.body.suggestedRestockQty, 7)

    const alerts = await request(app).get('/api/v1/inventory/alerts')
    assert.equal(alerts.status, 200)
    assert.equal(alerts.body.pagination.total, 1)
    assert.equal(alerts.body.data[0].sku, 'LOW-STOCK')
    assert.equal(alerts.body.data[0].reason, 'at_or_below_reorder_point')
  })

  it('allows setting a per-SKU reorder point without changing quantity', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'HAT-9',
      name: 'Hat',
      priceCents: 1800,
      initialStock: 18,
      reorderPoint: 20,
    })

    const createdAlert = await request(app).get('/api/v1/inventory/alerts')
    assert.equal(createdAlert.body.data.some((row: { sku: string }) => row.sku === 'HAT-9'), true)

    const patched = await request(app)
      .patch('/api/v1/inventory/HAT-9')
      .send({ reorderPoint: 2 })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.quantity, 18)
    assert.equal(patched.body.reorderPoint, 2)

    const alerts = await request(app).get('/api/v1/inventory/alerts')
    assert.equal(alerts.body.data.some((row: { sku: string }) => row.sku === 'HAT-9'), false)
  })

  it('does not treat /alerts as a SKU', async () => {
    const res = await request(app).get('/api/v1/inventory/alerts')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
  })

  it('returns the restock alert count without pagination', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'COUNT-A',
      name: 'Low A',
      priceCents: 500,
      initialStock: 2,
    })
    await request(app).post('/api/v1/products').send({
      sku: 'COUNT-B',
      name: 'Low B',
      priceCents: 600,
      initialStock: 1,
    })
    await request(app).post('/api/v1/products').send({
      sku: 'COUNT-OK',
      name: 'Healthy',
      priceCents: 700,
      initialStock: 50,
    })

    const res = await request(app).get('/api/v1/inventory/alerts/count')
    assert.equal(res.status, 200)
    assert.equal(res.body.count, 2)

    const alerts = await request(app).get('/api/v1/inventory/alerts')
    assert.equal(alerts.body.pagination.total, res.body.count)
  })

  it('updates stock and reorder point together without coupling reorder-only to quantity guards', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'COMBO-1',
      name: 'Combo',
      priceCents: 1500,
      initialStock: 10,
      reorderPoint: 5,
    })

    const patched = await request(app)
      .patch('/api/v1/inventory/COMBO-1')
      .send({ delta: 4, reorderPoint: 12 })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.quantity, 14)
    assert.equal(patched.body.reorderPoint, 12)
    assert.equal(patched.body.suggestedRestockQty, 10)
  })
})
