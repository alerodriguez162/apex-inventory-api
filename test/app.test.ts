import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'

describe('Day 1 API scaffold', () => {
  it('GET /api/health returns service metadata and a request id', async () => {
    const res = await request(app).get('/api/health')

    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.service, 'apex-inventory-api')
    assert.equal(typeof res.body.uptimeSeconds, 'number')
    assert.ok(res.headers['x-request-id'])
  })

  it('reuses X-Request-Id when the client sends one', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'bench-day-1')

    assert.equal(res.headers['x-request-id'], 'bench-day-1')
    assert.equal(res.body.status, 'ok')
  })

  it('GET /api/v1 returns the resource map', async () => {
    const res = await request(app).get('/api/v1')

    assert.equal(res.status, 200)
    assert.equal(res.body.version, 'v1')
    assert.equal(res.body.resources.products.status, 'available')
    assert.equal(res.body.resources.orders.availableFrom, 'Day 3')
  })

  it('DELETE /api/v1/products returns 405 with Allow', async () => {
    const res = await request(app).delete('/api/v1/products')

    assert.equal(res.status, 405)
    assert.equal(res.body.code, 'METHOD_NOT_ALLOWED')
    assert.match(String(res.headers.allow), /GET/)
    assert.match(String(res.headers.allow), /POST/)
  })

  it('unknown routes return 404', async () => {
    const res = await request(app).get('/api/v1/unknown')

    assert.equal(res.status, 404)
    assert.equal(res.body.code, 'NOT_FOUND')
  })

  it('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Content-Type', 'application/json')
      .send('{"sku":')

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'INVALID_JSON')
  })
})
