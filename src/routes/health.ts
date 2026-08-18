import { Router } from 'express'
import { config } from '../config.js'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'

const startedAt = Date.now()

export const healthRouter = Router()

healthRouter
  .route('/')
  .get((_req, res) => {
    res.json({
      status: 'ok',
      service: config.service,
      version: config.version,
      env: config.env,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    })
  })
  .all(methodNotAllowed(['GET']))
