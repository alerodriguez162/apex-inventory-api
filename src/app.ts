import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { requestId } from './middleware/request-id.js'
import { requestLogger } from './middleware/request-logger.js'
import { docsRouter } from './routes/docs.js'
import { healthRouter } from './routes/health.js'
import { inventoryRouter } from './routes/inventory.js'
import { ordersRouter } from './routes/orders.js'
import { productsRouter } from './routes/products.js'
import { statsRouter } from './routes/stats.js'
import { v1Router } from './routes/v1.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(compression())
app.use(cors({ origin: config.corsOrigin }))
app.use(requestId)
app.use(requestLogger)
app.use(express.json({ limit: config.jsonBodyLimit }))

if (config.env !== 'test') {
  app.use(
    '/api/',
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMITED',
      },
    }),
  )
}

app.get('/', (_req, res) => {
  res.json({
    service: config.service,
    version: config.version,
    docs: '/api/docs',
    openapi: '/api/docs/openapi.json',
    health: '/api/health',
    api: '/api/v1',
  })
})

app.use('/api/health', healthRouter)
app.use('/api/docs', docsRouter)
app.use('/api/v1', v1Router)
app.use('/api/v1/products', productsRouter)
app.use('/api/v1/inventory', inventoryRouter)
app.use('/api/v1/orders', ordersRouter)
app.use('/api/v1/stats', statsRouter)

app.use(notFound)
app.use(errorHandler)
