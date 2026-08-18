import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'
import { config } from '../config.js'

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'Request body is not valid JSON',
      code: 'INVALID_JSON',
      requestId: req.requestId,
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      requestId: req.requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    })
    return
  }

  const message = err instanceof Error ? err.message : 'Unexpected error'
  console.error(`[${req.requestId}]`, err)

  res.status(500).json({
    error: config.env === 'production' ? 'Internal server error' : message,
    code: 'INTERNAL_ERROR',
    requestId: req.requestId,
  })
}
