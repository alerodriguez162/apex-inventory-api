import { Router } from 'express'
import { methodNotAllowed } from '../middleware/method-not-allowed.js'
import { getApiStats } from '../services/stats.js'
import { AppError } from '../errors/app-error.js'

export const statsRouter = Router()

statsRouter
  .route('/')
  .get((req, res) => {
    const thresholdRaw =
      req.query.threshold !== undefined ? Number(req.query.threshold) : 5

    if (!Number.isInteger(thresholdRaw) || thresholdRaw < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'threshold must be a non-negative integer')
    }

    res.json(getApiStats(thresholdRaw))
  })
  .all(methodNotAllowed(['GET']))
