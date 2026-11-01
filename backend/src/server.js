import { createServer } from 'node:http'
import { createDatabase } from './database.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'
const database = createDatabase(process.env.DATABASE_PATH)
const app = createApp(database, {
  secureCookie: process.env.NODE_ENV === 'production',
})
const server = createServer(app)

server.listen(port, host, () => {
  console.log(`Feel & Flow server listening on http://${host}:${port}`)
})

function shutdown() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
