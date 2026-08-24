import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'

export const v1Router = Router()

v1Router
  .route('/')
  .get((_req, res) => {
    res.json({
      name: 'Apex Inventory & Order Management API',
      version: 'v1',
      conventions: {
        format: 'application/json',
        errors: '{ error, code, requestId }',
        versioning: 'URI prefix /api/v1',
        naming: 'plural nouns, no verbs in paths',
        orderLifecycle: 'confirmed → fulfilled | cancelled',
      },
      resources: {
        products: {
          href: '/api/v1/products',
          status: 'available',
          methods: ['GET', 'POST', 'PATCH'],
        },
        inventory: {
          href: '/api/v1/inventory',
          status: 'available',
          methods: ['GET', 'PATCH'],
        },
        orders: {
          href: '/api/v1/orders',
          status: 'available',
          methods: ['GET', 'POST'],
          actions: {
            cancellation: 'POST /api/v1/orders/:id/cancellation',
            fulfillment: 'POST /api/v1/orders/:id/fulfillment',
          },
        },
        stats: {
          href: '/api/v1/stats',
          status: 'available',
          methods: ['GET'],
        },
      },
    })
  })
  .all(methodNotAllowed(['GET']))
