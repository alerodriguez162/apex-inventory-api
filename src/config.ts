export const config = {
  port: Number(process.env.PORT) || 3001,
  env: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  service: 'apex-inventory-api',
  version: '0.2.0',
  jsonBodyLimit: '32kb',
} as const
