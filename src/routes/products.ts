import { Router } from 'express'
import { setPaginationHeaders } from '../http/pagination.js'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import {
  createProduct,
  getProductById,
  listProducts,
  updateProduct,
} from '../services/products.js'
import {
  createProductSchema,
  parsePagination,
  parseProductSort,
  updateProductSchema,
  validateBody,
} from '../validation.js'

export const productsRouter = Router()

productsRouter
  .route('/')
  .get((req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>)
    const sort = parseProductSort(req.query as Record<string, unknown>)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    const sku = typeof req.query.sku === 'string' ? req.query.sku.trim() : undefined
    const result = listProducts(pagination, { q, sku, sort })
    setPaginationHeaders(req, res, result)
    res.json(result)
  })
  .post(validateBody(createProductSchema), (req, res) => {
    const product = createProduct(req.body)
    res.setHeader('Location', `/api/v1/products/${product.id}`)
    res.status(201).json(product)
  })
  .all(methodNotAllowed(['GET', 'POST']))

productsRouter
  .route('/:id')
  .get((req, res) => {
    res.json(getProductById(req.params.id))
  })
  .patch(validateBody(updateProductSchema), (req, res) => {
    res.json(updateProduct(req.params.id, req.body))
  })
  .all(methodNotAllowed(['GET', 'PATCH']))
