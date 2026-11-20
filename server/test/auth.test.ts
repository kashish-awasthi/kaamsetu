import { describe, expect, it } from 'vitest'
import { api, auth, nextPhone, registerEmployer, registerWorker, useCleanDb } from './helpers.js'

useCleanDb()

describe('auth', () => {
  it('registers a worker with a profile and returns a token', async () => {
    const { token, user } = await registerWorker({ skills: ['Driving Licence', 'driving licence'], experienceYears: 3 })
    expect(token).toEqual(expect.any(String))
    expect(user).toMatchObject({ role: 'worker', city: 'Bengaluru', skills: ['driving licence'], experienceYears: 3 })
    expect(user).not.toHaveProperty('password_hash')
  })

  it('registers an employer together with their company', async () => {
    const { user } = await registerEmployer({ companyName: 'Metro Movers' })
    expect(user).toMatchObject({ role: 'employer', companyName: 'Metro Movers', companyId: expect.any(Number) })
  })

  it('returns field-level messages for invalid input', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ role: 'worker', name: 'R', phone: '12345', password: 'short', city: 'Atlantis' })
      .expect(400)
    expect(Object.keys(res.body.details.fields).sort()).toEqual(['city', 'name', 'password', 'phone'])
  })

  it('rejects a phone number that is already registered', async () => {
    const phone = nextPhone()
    await registerWorker({ phone })
    const res = await api()
      .post('/api/auth/register')
      .send({ role: 'employer', name: 'Someone', phone, password: 'secret123', companyName: 'Acme' })
      .expect(409)
    expect(res.body.details.fields.phone).toBe('Already registered')
  })

  it('logs in with the right password, with one generic message otherwise', async () => {
    const phone = nextPhone()
    await registerWorker({ phone })
    const ok = await api().post('/api/auth/login').send({ phone, password: 'secret123' }).expect(200)
    expect(ok.body.user.phone).toBe(phone)

    const wrong = await api().post('/api/auth/login').send({ phone, password: 'nope-nope' }).expect(401)
    const unknown = await api().post('/api/auth/login').send({ phone: nextPhone(), password: 'secret123' }).expect(401)
    expect(wrong.body.error).toBe(unknown.body.error)
  })

  it('protects routes by login and by role', async () => {
    await api().get('/api/auth/me').expect(401)
    await api().get('/api/auth/me').set(auth('not-a-real-token')).expect(401)

    const { token } = await registerWorker()
    await api().get('/api/auth/me').set(auth(token)).expect(200)
    await api().get('/api/employer/jobs').set(auth(token)).expect(403)
  })
})
