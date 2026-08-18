import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import { notImplemented } from '../middleware/not-implemented.js'

export const inventoryRouter = Router()

inventoryRouter
  .route('/')
  .get(notImplemented('inventory', 'Day 2'))
  .all(methodNotAllowed(['GET']))

inventoryRouter
  .route('/:sku')
  .get(notImplemented('inventory', 'Day 2'))
  .patch(notImplemented('inventory', 'Day 2'))
  .all(methodNotAllowed(['GET', 'PATCH']))
