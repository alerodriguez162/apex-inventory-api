import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../errors/app-error.js'
import type { Paginated } from '../types/domain.js'

export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex')
}

export function parseIdempotencyKey(req: Request): string | undefined {
  const raw = req.header('idempotency-key')?.trim()
  if (!raw) return undefined

  if (raw.length < 8 || raw.length > 128) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Idempotency-Key must be between 8 and 128 characters',
    )
  }

  return raw
}

export function setPaginationHeaders(
  req: Request,
  res: Response,
  pageResult: Paginated<unknown>,
): void {
  const { page, limit, total, totalPages } = pageResult.pagination
  res.setHeader('X-Total-Count', String(total))
  res.setHeader('X-Page', String(page))
  res.setHeader('X-Limit', String(limit))
  res.setHeader('X-Total-Pages', String(totalPages))

  const base = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`
  const links: string[] = []
  const q = new URLSearchParams()

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'page' || key === 'limit') continue
    if (typeof value === 'string') q.set(key, value)
  }
  q.set('limit', String(limit))

  const href = (p: number) => {
    const params = new URLSearchParams(q)
    params.set('page', String(p))
    return `<${base}?${params.toString()}>`
  }

  links.push(`${href(page)}; rel="self"`)
  if (page > 1) links.push(`${href(page - 1)}; rel="prev"`)
  if (page < totalPages) links.push(`${href(page + 1)}; rel="next"`)
  links.push(`${href(1)}; rel="first"`)
  links.push(`${href(totalPages)}; rel="last"`)

  res.setHeader('Link', links.join(', '))
}
