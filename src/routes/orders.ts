import { Router } from 'express'
import { AppError } from '../errors/app-error.js'
import {
  hashRequestBody,
  parseIdempotencyKey,
  setPaginationHeaders,
} from '../http/pagination.js'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import {
  cancelOrder,
  createOrder,
  fulfillOrder,
  getOrderById,
  listOrders,
} from '../services/orders.js'
import type { OrderStatus } from '../types/domain.js'
import { createOrderSchema, parsePagination, validateBody } from '../validation.js'

const ORDER_STATUSES = new Set<OrderStatus>([
  'pending',
  'confirmed',
  'cancelled',
  'fulfilled',
])

export const ordersRouter = Router()

ordersRouter
  .route('/')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined

    if (statusRaw && !ORDER_STATUSES.has(statusRaw as OrderStatus)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'status must be pending, confirmed, cancelled, or fulfilled',
      )
    }

    const result = listOrders(pagination, {
      status: statusRaw as OrderStatus | undefined,
    })
    setPaginationHeaders(req, res, result)
    res.json(result)
  })
  .post(validateBody(createOrderSchema), (req, res) => {
    const idempotencyKey = parseIdempotencyKey(req)
    const requestHash = idempotencyKey ? hashRequestBody(req.body) : undefined
    const { order, replayed } = createOrder(req.body, { idempotencyKey, requestHash })

    if (replayed) {
      res.setHeader('Idempotent-Replay', 'true')
      res.status(200).json(order)
      return
    }

    res.setHeader('Location', `/api/v1/orders/${order.id}`)
    res.status(201).json(order)
  })
  .all(methodNotAllowed(['GET', 'POST']))

ordersRouter
  .route('/:id')
  .get((req, res) => {
    res.json(getOrderById(req.params.id))
  })
  .all(methodNotAllowed(['GET']))

ordersRouter
  .route('/:id/cancellation')
  .post((req, res) => {
    res.json(cancelOrder(req.params.id))
  })
  .all(methodNotAllowed(['POST']))

ordersRouter
  .route('/:id/fulfillment')
  .post((req, res) => {
    res.json(fulfillOrder(req.params.id))
  })
  .all(methodNotAllowed(['POST']))
