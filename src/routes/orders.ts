import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import { notImplemented } from '../middleware/not-implemented.js'

export const ordersRouter = Router()

ordersRouter
  .route('/')
  .get(notImplemented('orders', 'Day 3'))
  .post(notImplemented('orders', 'Day 3'))
  .all(methodNotAllowed(['GET', 'POST']))

ordersRouter
  .route('/:id')
  .get(notImplemented('orders', 'Day 3'))
  .all(methodNotAllowed(['GET']))
