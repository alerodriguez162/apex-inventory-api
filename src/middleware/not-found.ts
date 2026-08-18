import type { RequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'

export const notFound: RequestHandler = (req) => {
  throw new AppError(404, 'NOT_FOUND', `No resource at ${req.method} ${req.path}`)
}
