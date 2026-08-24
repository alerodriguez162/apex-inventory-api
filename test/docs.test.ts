import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SQLITE_PATH = ':memory:'

const { app } = await import('../src/app.js')

describe('Day 5 docs', () => {
  it('serves OpenAPI JSON', async () => {
    const res = await request(app).get('/api/docs/openapi.json')
    assert.equal(res.status, 200)
    assert.equal(res.body.openapi, '3.0.3')
    assert.equal(res.body.info.title, 'Apex Inventory & Order Management API')
    assert.ok(res.body.paths['/api/v1/orders'])
  })

  it('points the root to docs', async () => {
    const res = await request(app).get('/')
    assert.equal(res.status, 200)
    assert.equal(res.body.docs, '/api/docs')
    assert.equal(res.body.version, '1.1.0')
  })
})
