import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { currentUser, requireAuth, signToken } from '../auth.js'
import { config } from '../config.js'
import { CITIES } from '../constants.js'
import { isPgError, PG, query, withTransaction } from '../db.js'
import { HttpError, notFound, parse } from '../http.js'

export const authRouter = Router()

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number')
const password = z.string().min(8, 'Use at least 8 characters').max(72)
const name = z.string().trim().min(2, 'Enter your name').max(80)

const RegisterSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('worker'),
    name,
    phone,
    password,
    city: z.enum(CITIES, { message: 'Choose your city' }),
    skills: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(15).default([]),
    experienceYears: z.coerce.number().int().min(0).max(50).default(0),
  }),
  z.object({
    role: z.literal('employer'),
    name,
    phone,
    password,
    companyName: z.string().trim().min(2, 'Enter your company name').max(120),
  }),
])

const LoginSchema = z.object({ phone, password: z.string().min(1, 'Enter your password') })

// Slows down password guessing. Generous in tests so suites can log in freely.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
})

authRouter.post('/register', async (req, res) => {
  const body = parse(RegisterSchema, req.body)
  const passwordHash = await bcrypt.hash(body.password, 10)

  try {
    const user = await withTransaction(async (db) => {
      const {
        rows: [u],
      } = await db.query<{ id: number }>(
        'INSERT INTO users (role, name, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [body.role, body.name, body.phone, passwordHash],
      )
      if (!u) throw new Error('insert returned no row')
      if (body.role === 'worker') {
        await db.query(
          'INSERT INTO worker_profiles (user_id, city, skills, experience_years) VALUES ($1, $2, $3, $4)',
          [u.id, body.city, [...new Set(body.skills)], body.experienceYears],
        )
      } else {
        await db.query('INSERT INTO companies (owner_id, name) VALUES ($1, $2)', [u.id, body.companyName])
      }
      return { id: u.id, role: body.role }
    })
    res.status(201).json({ token: signToken(user), user: await loadProfile(user.id) })
  } catch (err) {
    if (isPgError(err, PG.uniqueViolation)) {
      throw new HttpError(409, 'This mobile number is already registered. Please log in.', {
        fields: { phone: 'Already registered' },
      })
    }
    throw err
  }
})

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { phone, password } = parse(LoginSchema, req.body)
  const [user] = await query<{ id: number; role: 'worker' | 'employer'; password_hash: string }>(
    'SELECT id, role, password_hash FROM users WHERE phone = $1',
    [phone],
  )
  // Same message either way, so the endpoint doesn't reveal which numbers are registered.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Mobile number or password is incorrect')
  }
  res.json({ token: signToken(user), user: await loadProfile(user.id) })
})

authRouter.get('/me', requireAuth(), async (req, res) => {
  res.json({ user: await loadProfile(currentUser(req).id) })
})

export async function loadProfile(id: number) {
  const [profile] = await query(
    `SELECT u.id, u.role, u.name, u.phone,
            wp.city, wp.skills, wp.experience_years AS "experienceYears",
            c.id AS "companyId", c.name AS "companyName"
     FROM users u
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     LEFT JOIN companies c ON c.owner_id = u.id
     WHERE u.id = $1`,
    [id],
  )
  if (!profile) throw notFound('User')
  return profile
}
