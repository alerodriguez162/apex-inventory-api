import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { requestId } from './middleware/request-id.js'
import { requestLogger } from './middleware/request-logger.js'
import { healthRouter } from './routes/health.js'
import { inventoryRouter } from './routes/inventory.js'
import { ordersRouter } from './routes/orders.js'
import { productsRouter } from './routes/products.js'
import { v1Router } from './routes/v1.js'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.corsOrigin }))
app.use(requestId)
app.use(requestLogger)
app.use(express.json({ limit: config.jsonBodyLimit }))

app.get('/', (_req, res) => {
  res.json({
    service: config.service,
    docs: '/api/v1',
    health: '/api/health',
  })
})

app.use('/api/health', healthRouter)
app.use('/api/v1', v1Router)
app.use('/api/v1/products', productsRouter)
app.use('/api/v1/inventory', inventoryRouter)
app.use('/api/v1/orders', ordersRouter)

app.use(notFound)
app.use(errorHandler)
