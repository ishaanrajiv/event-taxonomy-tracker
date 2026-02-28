import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'

import { ensureSchema } from './db/init.js'
import { recoverInterruptedRuns } from './services/ai-runs.js'
import { registerRoutes } from './routes/register.js'
import { ensureStorageRoot } from './services/storage.js'

const buildServer = async () => {
  ensureSchema()
  ensureStorageRoot()
  await recoverInterruptedRuns()

  const app = Fastify({
    logger: true,
  })

  await app.register(sensible)
  await app.register(cors, {
    origin: [/localhost:/],
    credentials: true,
  })
  await app.register(multipart)

  await registerRoutes(app)

  return app
}

const start = async () => {
  const app = await buildServer()
  const port = Number(process.env.PORT ?? 8000)

  await app.listen({
    port,
    host: '0.0.0.0',
  })

  app.log.info(`API listening on http://localhost:${port}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  })
}

export { buildServer }
