import { Router } from 'express'
import { setPaginationHeaders } from '../http/pagination.js'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import { createProduct, getProductById, listProducts } from '../services/products.js'
import { createProductSchema, parsePagination, validateBody } from '../validation.js'

export const productsRouter = Router()

productsRouter
  .route('/')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    const sku = typeof req.query.sku === 'string' ? req.query.sku.trim() : undefined
    const result = listProducts(pagination, { q, sku })
    setPaginationHeaders(req, res, result)
    res.json(result)
  })
  .post(validateBody(createProductSchema), (req, res) => {
    const product = createProduct(req.body)
    res.status(201).json(product)
  })
  .all(methodNotAllowed(['GET', 'POST']))

productsRouter
  .route('/:id')
  .get((req, res) => {
    res.json(getProductById(req.params.id))
  })
  .all(methodNotAllowed(['GET']))
