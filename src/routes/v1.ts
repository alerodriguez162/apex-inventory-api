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
      },
      resources: {
        products: {
          href: '/api/v1/products',
          status: 'not_implemented',
          availableFrom: 'Day 2',
          methods: ['GET', 'POST'],
        },
        inventory: {
          href: '/api/v1/inventory',
          status: 'not_implemented',
          availableFrom: 'Day 2',
          methods: ['GET', 'PATCH'],
        },
        orders: {
          href: '/api/v1/orders',
          status: 'not_implemented',
          availableFrom: 'Day 3',
          methods: ['GET', 'POST'],
        },
      },
    })
  })
  .all(methodNotAllowed(['GET']))
