import type { IncomingMessage, ServerResponse } from 'node:http'

type ExpressApp = (req: IncomingMessage, res: ServerResponse) => void

let appPromise: Promise<ExpressApp> | null = null

async function loadApp(): Promise<ExpressApp> {
  if (!appPromise) {
    appPromise = (async () => {
      const { app } = await import('../src/app.js')
      if (process.env.VERCEL) {
        const { getApiStats } = await import('../src/services/stats.js')
        const { seedDemoCatalog } = await import('../src/seed.js')
        if (getApiStats().products === 0) {
          seedDemoCatalog()
        }
      }
      return app as ExpressApp
    })()
  }
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await loadApp()
  return app(req, res)
}
