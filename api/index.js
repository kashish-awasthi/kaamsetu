// Vercel serverless entry: the same Express app, built from server/ by `npm run build`.
import { createApp } from '../server/dist/src/app.js'

export default createApp()
