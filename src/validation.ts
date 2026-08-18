import { z } from 'zod'
import type { RequestHandler } from 'express'
import { AppError } from './errors/app-error.js'
import type { Pagination } from './types/domain.js'

export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-_]*$/, 'SKU must be alphanumeric'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  priceCents: z.number().int().min(0).max(100_000_000),
  initialStock: z.number().int().min(0).max(1_000_000).optional(),
})

export const updateInventorySchema = z
  .object({
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .refine((body) => body.quantity !== undefined || body.delta !== undefined, {
    message: 'Provide quantity or delta',
  })
  .refine((body) => !(body.quantity !== undefined && body.delta !== undefined), {
    message: 'Provide either quantity or delta, not both',
  })

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(64),
        quantity: z.number().int().min(1).max(10_000),
      }),
    )
    .min(1)
    .max(50),
})

export function parsePagination(query: Record<string, unknown>): Pagination {
  const pageRaw = query.page === undefined ? 1 : Number(query.page)
  const limitRaw = query.limit === undefined ? 20 : Number(query.limit)

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'page must be a positive integer')
  }

  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'limit must be an integer between 1 and 100')
  }

  return { page: pageRaw, limit: limitRaw }
}

export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.') || '(root)',
            message: issue.message,
          })),
        }),
      )
      return
    }

    req.body = result.data
    next()
  }
}
