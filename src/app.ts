import cors from 'cors'
import express from 'express'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'apex-inventory-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'Apex Inventory & Order Management API',
    version: 'v1',
    resources: {
      products: { href: '/api/v1/products', status: 'planned' },
      inventory: { href: '/api/v1/inventory', status: 'planned' },
      orders: { href: '/api/v1/orders', status: 'planned' },
    },
  })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})
