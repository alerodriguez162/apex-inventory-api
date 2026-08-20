import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')
const { resetDatabase } = await import('../src/db.js')

describe('Day 4 validation, pagination, idempotency', () => {
  before(() => {
    resetDatabase()
  })

  afterEach(() => {
    resetDatabase()
  })

  it('returns pagination headers on product lists', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/products')
        .send({
          sku: `SKU-${i}`,
          name: `Item ${i}`,
          priceCents: 1000 + i,
          initialStock: 5,
        })
    }

    const res = await request(app).get('/api/v1/products?page=1&limit=2')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.length, 2)
    assert.equal(res.headers['x-total-count'], '3')
    assert.equal(res.headers['x-total-pages'], '2')
    assert.match(String(res.headers.link), /rel="next"/)
  })

  it('rejects invalid pagination params', async () => {
    const res = await request(app).get('/api/v1/products?page=0&limit=200')
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  it('replays identical order creates with Idempotency-Key', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'IDEMP-001',
      name: 'Idempotent',
      priceCents: 1500,
      initialStock: 10,
    })

    const payload = { items: [{ sku: 'IDEMP-001', quantity: 2 }] }
    const first = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'bench-order-001')
      .send(payload)

    const second = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'bench-order-001')
      .send(payload)

    assert.equal(first.status, 201)
    assert.equal(second.status, 200)
    assert.equal(second.headers['idempotent-replay'], 'true')
    assert.equal(first.body.id, second.body.id)

    const stock = await request(app).get('/api/v1/inventory/IDEMP-001')
    assert.equal(stock.body.reserved, 2)
  })

  it('rejects Idempotency-Key reuse with a different body', async () => {
    await request(app).post('/api/v1/products').send({
      sku: 'IDEMP-002',
      name: 'Conflict',
      priceCents: 900,
      initialStock: 10,
    })

    await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'bench-order-002')
      .send({ items: [{ sku: 'IDEMP-002', quantity: 1 }] })

    const conflict = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'bench-order-002')
      .send({ items: [{ sku: 'IDEMP-002', quantity: 2 }] })

    assert.equal(conflict.status, 409)
    assert.equal(conflict.body.code, 'IDEMPOTENCY_KEY_REUSE')
  })
})
