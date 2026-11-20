import { describe, expect, it } from 'vitest'
import { pool } from '../src/db.js'
import { toPrefixQuery } from '../src/routes/jobs.js'
import { api, auth, createJob, registerEmployer, registerWorker, useCleanDb, validJob } from './helpers.js'

useCleanDb()

describe('posting jobs', () => {
  it('validates salary range and category', async () => {
    const { token } = await registerEmployer()
    const bad = await api()
      .post('/api/employer/jobs')
      .set(auth(token))
      .send({ ...validJob, salaryMin: 20000, salaryMax: 15000 })
      .expect(400)
    expect(bad.body.details.fields.salaryMax).toMatch(/at least the minimum/)

    await api().post('/api/employer/jobs').set(auth(token)).send({ ...validJob, category: 'astronaut' }).expect(400)
  })
})

describe('job feed', () => {
  it('filters by city, category, shift and minimum salary', async () => {
    const { token } = await registerEmployer()
    await createJob(token, { city: 'Pune', category: 'driver', title: 'Cab Driver', shift: 'night', salaryMin: 20000, salaryMax: 26000 })
    await createJob(token, { city: 'Pune', category: 'delivery', salaryMin: 12000, salaryMax: 15000 })
    await createJob(token, { city: 'Mumbai', category: 'driver', title: 'Truck Driver' })

    const pune = await api().get('/api/jobs?city=Pune').expect(200)
    expect(pune.body.items).toHaveLength(2)

    const puneDrivers = await api().get('/api/jobs?city=Pune&category=driver&shift=night').expect(200)
    expect(puneDrivers.body.items.map((j: { title: string }) => j.title)).toEqual(['Cab Driver'])

    const wellPaid = await api().get('/api/jobs?minSalary=25000').expect(200)
    expect(wellPaid.body.items.map((j: { title: string }) => j.title)).toEqual(['Cab Driver'])
  })

  it('searches title and description with prefix matching', async () => {
    const { token } = await registerEmployer()
    await createJob(token, { title: 'Forklift Operator', category: 'warehouse', description: 'Operate a forklift in a large warehouse in Whitefield.' })
    await createJob(token, { title: 'Delivery Partner' })

    const byPrefix = await api().get('/api/jobs').query({ q: 'fork' }).expect(200)
    expect(byPrefix.body.items.map((j: { title: string }) => j.title)).toEqual(['Forklift Operator'])

    const byDescription = await api().get('/api/jobs').query({ q: 'whitefield' }).expect(200)
    expect(byDescription.body.items).toHaveLength(1)

    // Punctuation and SQL-looking input is stripped, never sent raw to to_tsquery.
    await api().get('/api/jobs').query({ q: "'); DROP TABLE jobs; --" }).expect(200)
    expect(toPrefixQuery("deliv & bang|!")).toBe('deliv:* & bang:*')
    expect(toPrefixQuery('!!!')).toBeNull()
  })

  it('pages through results with a cursor, with no duplicates or gaps', async () => {
    const { user } = await registerEmployer()
    // 25 jobs, several sharing a timestamp, to prove the id tiebreak keeps ordering stable.
    await pool.query(
      `INSERT INTO jobs (company_id, title, description, category, city, salary_min, salary_max, shift, created_at)
       SELECT $1, 'Job ' || g, 'A description for this test job', 'delivery', 'Delhi', 15000, 18000, 'day',
              timestamptz '2026-11-01' + (g / 3) * interval '1 hour'
       FROM generate_series(1, 25) g`,
      [user.companyId],
    )

    const seen: number[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const res = await api().get('/api/jobs').query({ limit: 10, ...(cursor ? { cursor } : {}) }).expect(200)
      seen.push(...res.body.items.map((j: { id: number }) => j.id))
      cursor = res.body.nextCursor
      pages++
    } while (cursor)

    expect(pages).toBe(3)
    expect(new Set(seen).size).toBe(25)
    const { rows } = await pool.query('SELECT id FROM jobs ORDER BY created_at DESC, id DESC')
    expect(seen).toEqual(rows.map((r) => r.id))

    await api().get('/api/jobs?cursor=garbage').expect(400)
  })

  it('hides closed jobs and personalises results for a logged-in worker', async () => {
    const emp = await registerEmployer()
    const open = await createJob(emp.token, { skills: ['two-wheeler', 'smartphone', 'hindi'] })
    const closed = await createJob(emp.token, { title: 'Closed Job' })
    await api().patch(`/api/employer/jobs/${closed.id}`).set(auth(emp.token)).send({ isOpen: false }).expect(200)

    const worker = await registerWorker({ skills: ['two-wheeler', 'hindi'] })
    await api().post(`/api/jobs/${open.id}/apply`).set(auth(worker.token)).expect(201)

    const res = await api().get('/api/jobs').set(auth(worker.token)).expect(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({ id: open.id, matchedSkills: 2, applied: true })

    const anon = await api().get('/api/jobs').expect(200)
    expect(anon.body.items[0]).toMatchObject({ matchedSkills: null, applied: null })
  })
})
