import type { RequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'

export function methodNotAllowed(allowed: readonly string[]): RequestHandler {
  return (req, res) => {
    const allow = allowed.join(', ')
    res.setHeader('Allow', allow)
    throw new AppError(
      405,
      'METHOD_NOT_ALLOWED',
      `${req.method} is not allowed on ${req.path}`,
      { allowed },
    )
  }
}
