import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import {
  getInventoryBySku,
  listInventory,
  updateInventory,
} from '../services/products.js'
import { parsePagination, updateInventorySchema, validateBody } from '../validation.js'

export const inventoryRouter = Router()

inventoryRouter
  .route('/')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const lowStock =
      req.query.lowStock === 'true' || req.query.lowStock === '1'
    const threshold =
      req.query.threshold !== undefined ? Number(req.query.threshold) : undefined

    if (threshold !== undefined && (!Number.isInteger(threshold) || threshold < 0)) {
      res.status(400).json({
        error: 'threshold must be a non-negative integer',
        code: 'VALIDATION_ERROR',
        requestId: req.requestId,
      })
      return
    }

    res.json(listInventory(pagination, { lowStock, threshold }))
  })
  .all(methodNotAllowed(['GET']))

inventoryRouter
  .route('/:sku')
  .get((req, res) => {
    res.json(getInventoryBySku(req.params.sku))
  })
  .patch(validateBody(updateInventorySchema), (req, res) => {
    res.json(updateInventory(req.params.sku, req.body))
  })
  .all(methodNotAllowed(['GET', 'PATCH']))
