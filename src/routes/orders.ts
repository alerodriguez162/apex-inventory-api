import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import {
  cancelOrder,
  createOrder,
  getOrderById,
  listOrders,
} from '../services/orders.js'
import type { OrderStatus } from '../types/domain.js'
import { createOrderSchema, parsePagination, validateBody } from '../validation.js'
import { AppError } from '../errors/app-error.js'

const ORDER_STATUSES = new Set<OrderStatus>(['pending', 'confirmed', 'cancelled'])

export const ordersRouter = Router()

ordersRouter
  .route('/')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined

    if (statusRaw && !ORDER_STATUSES.has(statusRaw as OrderStatus)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'status must be pending, confirmed, or cancelled')
    }

    res.json(
      listOrders(pagination, {
        status: statusRaw as OrderStatus | undefined,
      }),
    )
  })
  .post(validateBody(createOrderSchema), (req, res) => {
    const idempotencyKey = req.header('idempotency-key')?.trim() || undefined
    const { order, replayed } = createOrder(req.body, { idempotencyKey })

    if (replayed) {
      res.setHeader('Idempotent-Replay', 'true')
      res.status(200).json(order)
      return
    }

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
