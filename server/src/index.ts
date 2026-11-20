import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db.js'

const server = createApp().listen(config.port, () => {
  console.log(`KaamSetu API listening on http://localhost:${config.port}`)
})

// Finish in-flight requests and close database connections before exiting.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  server.close(() => void pool.end().then(() => process.exit(0)))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
