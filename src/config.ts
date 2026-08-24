export const config = {
  port: Number(process.env.PORT) || 3001,
  env: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  service: 'apex-inventory-api',
  version: '1.1.0',
  jsonBodyLimit: '32kb',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 120,
} as const
