import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import { notImplemented } from '../middleware/not-implemented.js'

export const productsRouter = Router()

productsRouter
  .route('/')
  .get(notImplemented('products', 'Day 2'))
  .post(notImplemented('products', 'Day 2'))
  .all(methodNotAllowed(['GET', 'POST']))

productsRouter
  .route('/:id')
  .get(notImplemented('products', 'Day 2'))
  .all(methodNotAllowed(['GET']))
