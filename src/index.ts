import { app } from './app.js'
import { config } from './config.js'

const server = app.listen(config.port, () => {
  console.log(`${config.service} listening on http://localhost:${config.port}`)
})

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })

  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
