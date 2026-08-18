import type { RequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'

export function notImplemented(
  resource: string,
  availableFrom: string,
): RequestHandler {
  return (req) => {
    throw new AppError(
      501,
      'NOT_IMPLEMENTED',
      `${req.method} ${req.path} is defined but not implemented yet`,
      { resource, availableFrom },
    )
  }
}
