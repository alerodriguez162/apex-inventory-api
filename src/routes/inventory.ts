import { Router } from 'express'
import { AppError } from '../errors/app-error.js'
import { setPaginationHeaders } from '../http/pagination.js'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import {
  countRestockAlerts,
  getInventoryBySku,
  listInventory,
  listRestockAlerts,
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
      throw new AppError(400, 'VALIDATION_ERROR', 'threshold must be a non-negative integer')
    }

    const result = listInventory(pagination, { lowStock, threshold })
    setPaginationHeaders(req, res, result)
    res.json(result)
  })
  .all(methodNotAllowed(['GET']))

inventoryRouter
  .route('/alerts')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const result = listRestockAlerts(pagination)
    setPaginationHeaders(req, res, result)
    res.json(result)
  })
  .all(methodNotAllowed(['GET']))

inventoryRouter
  .route('/alerts/count')
  .get((_req, res) => {
    res.json({ count: countRestockAlerts() })
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
