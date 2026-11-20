import express from 'express'
import helmet from 'helmet'
import { CITIES, SHIFTS } from './constants.js'
import { query } from './db.js'
import { errorHandler, unknownRoute } from './http.js'
import { authRouter } from './routes/auth.js'
import { employerRouter } from './routes/employer.js'
import { jobsRouter } from './routes/jobs.js'
import { meRouter } from './routes/me.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  api.get('/health', async (_req, res) => {
    await query('SELECT 1')
    res.json({ ok: true })
  })
  api.get('/meta', async (_req, res) => {
    const categories = await query('SELECT slug, label FROM categories ORDER BY label')
    res.set('Cache-Control', 'public, max-age=300').json({ cities: CITIES, shifts: SHIFTS, categories })
  })
  api.use('/auth', authRouter)
  api.use('/jobs', jobsRouter)
  api.use('/me', meRouter)
  api.use('/employer', employerRouter)

  app.use('/api', api)
  app.use(unknownRoute)
  app.use(errorHandler)
  return app
}
