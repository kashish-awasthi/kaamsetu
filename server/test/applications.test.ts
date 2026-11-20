import { describe, expect, it } from 'vitest'
import { pool } from '../src/db.js'
import { api, auth, createJob, registerEmployer, registerWorker, useCleanDb } from './helpers.js'

useCleanDb()

const move = (token: string, applicationId: number, status: string) =>
  api().patch(`/api/employer/applications/${applicationId}`).set(auth(token)).send({ status })

describe('applying', () => {
  it('applies once; a second tap gets a clear 409', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token)
    const w = await registerWorker()

    await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)
    const again = await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(409)
    expect(again.body.error).toMatch(/already applied/)
  })

  it('stays correct when the same worker applies 10 times at once', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token)
    const w = await registerWorker()

    const results = await Promise.all(
      Array.from({ length: 10 }, () => api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token))),
    )
    const codes = results.map((r) => r.status).sort()
    expect(codes).toEqual([201, ...Array(9).fill(409)])
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM applications WHERE job_id = $1', [job.id])
    expect(rows[0].n).toBe(1)
  })

  it('refuses closed and missing jobs, and employers', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token)
    await api().patch(`/api/employer/jobs/${job.id}`).set(auth(emp.token)).send({ isOpen: false }).expect(200)
    const w = await registerWorker()

    await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(410)
    await api().post('/api/jobs/999999/apply').set(auth(w.token)).expect(404)
    await api().post(`/api/jobs/${job.id}/apply`).set(auth(emp.token)).expect(403)
  })
})

describe('hiring pipeline', () => {
  it('only allows valid moves, and records a timeline the worker can see', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token)
    const w = await registerWorker()
    const { body } = await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)
    const appId = body.application.id

    const skip = await move(emp.token, appId, 'hired').expect(422)
    expect(skip.body.details.allowed).toEqual(['shortlisted', 'rejected'])

    for (const status of ['shortlisted', 'interview', 'hired']) await move(emp.token, appId, status).expect(200)
    await move(emp.token, appId, 'rejected').expect(422) // hired is final

    const mine = await api().get('/api/me/applications').set(auth(w.token)).expect(200)
    expect(mine.body.items[0].status).toBe('hired')
    expect(mine.body.items[0].timeline.map((e: { status: string }) => e.status)).toEqual(['applied', 'shortlisted', 'interview', 'hired'])
  })

  it('never over-hires: two recruiters filling the last opening at once', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token, { openings: 1 })
    const ids: number[] = []
    for (let i = 0; i < 2; i++) {
      const w = await registerWorker()
      const { body } = await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)
      ids.push(body.application.id)
      await move(emp.token, body.application.id, 'shortlisted').expect(200)
      await move(emp.token, body.application.id, 'interview').expect(200)
    }

    const [a, b] = await Promise.all(ids.map((id) => move(emp.token, id, 'hired')))
    expect([a!.status, b!.status].sort()).toEqual([200, 409])
    expect([a!.body.jobClosed, b!.body.jobClosed]).toContain(true)

    const { rows } = await pool.query(
      `SELECT j.is_open, count(*) FILTER (WHERE a.status = 'hired')::int AS hired
       FROM jobs j JOIN applications a ON a.job_id = j.id WHERE j.id = $1 GROUP BY j.id`,
      [job.id],
    )
    expect(rows[0]).toEqual({ is_open: false, hired: 1 })
  })

  it("keeps each employer out of other companies' applicants", async () => {
    const owner = await registerEmployer()
    const rival = await registerEmployer({ companyName: 'Rival Co' })
    const job = await createJob(owner.token)
    const w = await registerWorker()
    const { body } = await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)

    await api().get(`/api/employer/jobs/${job.id}/applicants`).set(auth(rival.token)).expect(404)
    await move(rival.token, body.application.id, 'shortlisted').expect(404)
  })

  it('ranks applicants by how many required skills they have', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token, { skills: ['two-wheeler', 'smartphone', 'hindi'] })
    const weak = await registerWorker({ name: 'Weak Match', skills: ['cooking'] })
    const strong = await registerWorker({ name: 'Strong Match', skills: ['two-wheeler', 'smartphone', 'hindi'] })
    const mid = await registerWorker({ name: 'Mid Match', skills: ['hindi'] })
    for (const w of [weak, strong, mid]) await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)

    const res = await api().get(`/api/employer/jobs/${job.id}/applicants`).set(auth(emp.token)).expect(200)
    expect(res.body.items.map((a: { name: string; matchedSkills: number }) => [a.name, a.matchedSkills])).toEqual([
      ['Strong Match', 3],
      ['Mid Match', 1],
      ['Weak Match', 0],
    ])
  })

  it('reports dashboard stats', async () => {
    const emp = await registerEmployer()
    const job = await createJob(emp.token, { openings: 4 })
    const w = await registerWorker()
    const { body } = await api().post(`/api/jobs/${job.id}/apply`).set(auth(w.token)).expect(201)
    await move(emp.token, body.application.id, 'shortlisted').expect(200)

    const stats = await api().get('/api/employer/stats').set(auth(emp.token)).expect(200)
    expect(stats.body).toMatchObject({
      jobs: { open: 1, total: 1, openings: 4 },
      pipeline: { applied: 0, shortlisted: 1, interview: 0, hired: 0, rejected: 0 },
      newThisWeek: 1,
    })
  })
})
