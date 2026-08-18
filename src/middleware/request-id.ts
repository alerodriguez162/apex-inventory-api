import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id')?.trim()
  req.requestId = incoming && incoming.length > 0 ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.requestId)
  next()
}
