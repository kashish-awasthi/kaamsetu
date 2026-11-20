import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth } from '../auth.js'
import { APPLICATION_STATUSES, CITIES, SHIFTS, TRANSITIONS, type ApplicationStatus } from '../constants.js'
import { isPgError, PG, query, withTransaction } from '../db.js'
import { HttpError, idParam, notFound, parse } from '../http.js'

export const employerRouter = Router()
employerRouter.use(requireAuth('employer'))

async function companyIdFor(userId: number): Promise<number> {
  const [c] = await query<{ id: number }>('SELECT id FROM companies WHERE owner_id = $1', [userId])
  if (!c) throw new HttpError(403, 'Set up your company first')
  return c.id
}

/** Dashboard numbers. The independent queries run in parallel on separate pool connections. */
employerRouter.get('/stats', async (req, res) => {
  const companyId = await companyIdFor(currentUser(req).id)
  const [[jobs], [pipeline], recent] = await Promise.all([
    query(
      `SELECT count(*) FILTER (WHERE is_open)::int AS open, count(*)::int AS total,
              COALESCE(sum(openings) FILTER (WHERE is_open), 0)::int AS openings
       FROM jobs WHERE company_id = $1`,
      [companyId],
    ),
    query(
      `SELECT ${APPLICATION_STATUSES.map((s) => `count(*) FILTER (WHERE a.status = '${s}')::int AS ${s}`).join(', ')}
       FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1`,
      [companyId],
    ),
    query(
      `SELECT count(*)::int AS "newThisWeek"
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = $1 AND a.created_at > now() - interval '7 days'`,
      [companyId],
    ),
  ])
  res.json({ jobs, pipeline, newThisWeek: recent[0]?.newThisWeek ?? 0 })
})

employerRouter.get('/jobs', async (req, res) => {
  const companyId = await companyIdFor(currentUser(req).id)
  const items = await query(
    `SELECT j.id, j.title, j.city, j.category, j.openings, j.is_open AS "isOpen", j.created_at AS "createdAt",
            j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
            json_build_object(${APPLICATION_STATUSES.map((s) => `'${s}', count(a.id) FILTER (WHERE a.status = '${s}')`).join(', ')}) AS pipeline,
            count(a.id)::int AS total
     FROM jobs j
     LEFT JOIN applications a ON a.job_id = j.id
     WHERE j.company_id = $1
     GROUP BY j.id
     ORDER BY j.is_open DESC, j.created_at DESC
     LIMIT 200`,
    [companyId],
  )
  res.json({ items })
})

const JobSchema = z
  .object({
    title: z.string().trim().min(3, 'Enter a job title').max(120),
    description: z.string().trim().min(20, 'Describe the job in at least 20 characters').max(4000),
    category: z.string().trim().min(2).max(40),
    city: z.enum(CITIES, { message: 'Choose a city' }),
    salaryMin: z.coerce.number().int().min(1000, 'Enter a monthly salary').max(1_000_000),
    salaryMax: z.coerce.number().int().min(1000).max(1_000_000),
    shift: z.enum(SHIFTS),
    openings: z.coerce.number().int().min(1).max(500).default(1),
    skills: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(15).default([]),
  })
  .refine((j) => j.salaryMax >= j.salaryMin, { path: ['salaryMax'], message: 'Must be at least the minimum salary' })

employerRouter.post('/jobs', async (req, res) => {
  const companyId = await companyIdFor(currentUser(req).id)
  const j = parse(JobSchema, req.body)
  try {
    const [job] = await query(
      `INSERT INTO jobs (company_id, title, description, category, city, salary_min, salary_max, shift, openings, skills)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, city, is_open AS "isOpen", created_at AS "createdAt"`,
      [companyId, j.title, j.description, j.category, j.city, j.salaryMin, j.salaryMax, j.shift, j.openings, [...new Set(j.skills)]],
    )
    res.status(201).json({ job })
  } catch (err) {
    if (isPgError(err, PG.foreignKeyViolation)) throw new HttpError(400, 'Unknown category', { fields: { category: 'Choose a category' } })
    throw err
  }
})

employerRouter.patch('/jobs/:id', async (req, res) => {
  const id = parse(idParam, req.params.id)
  const { isOpen } = parse(z.object({ isOpen: z.boolean() }), req.body)
  const companyId = await companyIdFor(currentUser(req).id)
  const [job] = await query(
    `UPDATE jobs SET is_open = $3 WHERE id = $1 AND company_id = $2 RETURNING id, is_open AS "isOpen"`,
    [id, companyId, isOpen],
  )
  if (!job) throw notFound('Job')
  res.json({ job })
})

/**
 * Applicants for one job, best match first: how many of the job's required
 * skills the worker has, then experience, then who applied first.
 */
employerRouter.get('/jobs/:id/applicants', async (req, res) => {
  const id = parse(idParam, req.params.id)
  const { status } = parse(z.object({ status: z.enum(APPLICATION_STATUSES).optional() }), req.query)
  const companyId = await companyIdFor(currentUser(req).id)

  const [job] = await query(
    `SELECT id, title, city, openings, is_open AS "isOpen", skills,
            (SELECT count(*)::int FROM applications WHERE job_id = jobs.id AND status = 'hired') AS hired
     FROM jobs WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  )
  // 404 rather than 403, so employers can't probe which job ids exist at other companies.
  if (!job) throw notFound('Job')

  const items = await query(
    `SELECT a.id, a.status, a.created_at AS "appliedAt",
            u.name, u.phone, wp.city, wp.skills, wp.experience_years AS "experienceYears",
            cardinality(ARRAY(SELECT unnest(j.skills) INTERSECT SELECT unnest(wp.skills)))::int AS "matchedSkills"
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.worker_id
     JOIN worker_profiles wp ON wp.user_id = a.worker_id
     WHERE a.job_id = $1 AND ($2::application_status IS NULL OR a.status = $2)
     ORDER BY "matchedSkills" DESC, wp.experience_years DESC, a.created_at ASC
     LIMIT 300`,
    [id, status ?? null],
  )
  res.json({ job, items })
})

/**
 * Moves an application through the pipeline. Runs in one transaction with
 * both the application and its job row locked, so two recruiters can't fill
 * the last opening at the same time. Hiring the last opening closes the job.
 */
employerRouter.patch('/applications/:id', async (req, res) => {
  const id = parse(idParam, req.params.id)
  const { status: to } = parse(z.object({ status: z.enum(APPLICATION_STATUSES) }), req.body)
  const user = currentUser(req)
  const companyId = await companyIdFor(user.id)

  const result = await withTransaction(async (db) => {
    const {
      rows: [row],
    } = await db.query<{ status: ApplicationStatus; job_id: number; openings: number; company_id: number }>(
      `SELECT a.status, a.job_id, j.openings, j.company_id
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1
       FOR UPDATE OF a, j`,
      [id],
    )
    if (!row || row.company_id !== companyId) throw notFound('Application')

    const from = row.status
    if (!TRANSITIONS[from].includes(to)) {
      throw new HttpError(422, `Can't move an application from ${from} to ${to}`, { allowed: TRANSITIONS[from] })
    }

    let jobClosed = false
    if (to === 'hired') {
      const {
        rows: [h],
      } = await db.query<{ hired: number }>(
        `SELECT count(*)::int AS hired FROM applications WHERE job_id = $1 AND status = 'hired'`,
        [row.job_id],
      )
      const hired = h?.hired ?? 0
      if (hired >= row.openings) throw new HttpError(409, 'All openings for this job are already filled')
      if (hired + 1 === row.openings) {
        await db.query('UPDATE jobs SET is_open = false WHERE id = $1', [row.job_id])
        jobClosed = true
      }
    }

    const {
      rows: [application],
    } = await db.query(
      `UPDATE applications SET status = $2, updated_at = now() WHERE id = $1
       RETURNING id, status, updated_at AS "updatedAt"`,
      [id, to],
    )
    await db.query(
      'INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES ($1, $2, $3, $4)',
      [id, from, to, user.id],
    )
    return { application, jobClosed }
  })

  res.json(result)
})
