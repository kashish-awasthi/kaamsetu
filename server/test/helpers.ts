import request from 'supertest'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { pool } from '../src/db.js'

export const app = createApp()
export const api = () => request(app)

let phoneCounter = 0
export const nextPhone = () => `9${String(100_000_000 + ++phoneCounter).slice(-9)}`

export function useCleanDb() {
  beforeEach(async () => {
    await pool.query('TRUNCATE users, companies, jobs, applications, application_events RESTART IDENTITY CASCADE')
  })
  afterAll(async () => {
    await pool.end()
  })
}

export async function registerWorker(overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/auth/register')
    .send({ role: 'worker', name: 'Ramesh Kumar', phone: nextPhone(), password: 'secret123', city: 'Bengaluru', skills: ['two-wheeler'], ...overrides })
    .expect(201)
  return { token: res.body.token as string, user: res.body.user }
}

export async function registerEmployer(overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/auth/register')
    .send({ role: 'employer', name: 'Anita Sharma', phone: nextPhone(), password: 'secret123', companyName: 'Swift Logistics', ...overrides })
    .expect(201)
  return { token: res.body.token as string, user: res.body.user }
}

export const validJob = {
  title: 'Delivery Partner',
  description: 'Deliver parcels across the city on a two-wheeler. Weekly payouts.',
  category: 'delivery',
  city: 'Bengaluru',
  salaryMin: 18000,
  salaryMax: 24000,
  shift: 'day',
  openings: 3,
  skills: ['two-wheeler', 'smartphone'],
}

export async function createJob(token: string, overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/employer/jobs')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...validJob, ...overrides })
    .expect(201)
  return res.body.job as { id: number }
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
