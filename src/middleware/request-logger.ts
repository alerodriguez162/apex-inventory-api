import type { RequestHandler } from 'express'

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now()

  res.on('finish', () => {
    const ms = Date.now() - started
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms rid=${req.requestId}`,
    )
  })

  next()
}
