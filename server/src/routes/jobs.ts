import { Router } from 'express'
import { z } from 'zod'
import { currentUser, optionalAuth, requireAuth } from '../auth.js'
import { CITIES, SHIFTS } from '../constants.js'
import { query, withTransaction } from '../db.js'
import { HttpError, idParam, notFound, parse } from '../http.js'

export const jobsRouter = Router()

// ---- Keyset (cursor) pagination ------------------------------------------
// OFFSET gets slower the deeper you page because Postgres still walks every
// skipped row. A cursor of (created_at, id) lets each page start straight
// from the index, so page 500 costs the same as page 1.

interface Cursor {
  at: string
  id: number
}
export const encodeCursor = (c: Cursor) => Buffer.from(`${c.at}|${c.id}`).toString('base64url')
export function decodeCursor(raw: string): Cursor {
  const [at, id] = Buffer.from(raw, 'base64url').toString().split('|')
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^\d+$/.test(id)) throw new HttpError(400, 'Invalid cursor')
  return { at, id: Number(id) }
}

/**
 * Turns free text into a prefix-matching tsquery: "deliv bang" becomes
 * "deliv:* & bang:*", so results appear while the user is still typing.
 * Anything that isn't a letter or digit is dropped, so input can't break the query.
 */
export function toPrefixQuery(text: string): string | null {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) ?? []
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null
}

const ListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  city: z.enum(CITIES).optional(),
  category: z.string().trim().max(40).optional(),
  shift: z.enum(SHIFTS).optional(),
  minSalary: z.coerce.number().int().min(0).max(1_000_000).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

jobsRouter.get('/', optionalAuth, async (req, res) => {
  const f = parse(ListSchema, req.query)
  const where = ['j.is_open']
  const params: unknown[] = []
  const add = (sql: string, value: unknown) => {
    params.push(value)
    where.push(sql.replace('?', `$${params.length}`))
  }

  if (f.city) add('j.city = ?', f.city)
  if (f.category) add('j.category = ?', f.category)
  if (f.shift) add('j.shift = ?', f.shift)
  if (f.minSalary) add('j.salary_max >= ?', f.minSalary)
  const tsq = f.q ? toPrefixQuery(f.q) : null
  if (tsq) add(`j.search @@ to_tsquery('simple', ?)`, tsq)
  if (f.cursor) {
    const c = decodeCursor(f.cursor)
    params.push(c.at, c.id)
    where.push(`(j.created_at, j.id) < ($${params.length - 1}, $${params.length})`)
  }

  // For a logged-in worker, also say how many of their skills each job asks for and whether they already applied.
  const worker = req.user?.role === 'worker' ? req.user.id : null
  params.push(worker)
  const w = `$${params.length}`
  params.push(f.limit + 1) // fetch one extra row to know if there's a next page

  const rows = await query<{ id: number; created_at: Date }>(
    `SELECT j.id, j.title, j.category, j.city, j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
            j.shift, j.openings, j.skills, j.created_at, c.name AS company,
            CASE WHEN ${w}::bigint IS NULL THEN NULL ELSE
              cardinality(ARRAY(SELECT unnest(j.skills) INTERSECT SELECT unnest(wp.skills))) END AS "matchedSkills",
            CASE WHEN ${w}::bigint IS NULL THEN NULL ELSE
              EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.worker_id = ${w}::bigint) END AS applied
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     LEFT JOIN worker_profiles wp ON wp.user_id = ${w}::bigint
     WHERE ${where.join(' AND ')}
     ORDER BY j.created_at DESC, j.id DESC
     LIMIT $${params.length}`,
    params,
  )

  const hasMore = rows.length > f.limit
  const items = rows.slice(0, f.limit)
  const last = items.at(-1)
  res.json({
    items: items.map(({ created_at, ...j }) => ({ ...j, createdAt: created_at })),
    nextCursor: hasMore && last ? encodeCursor({ at: last.created_at.toISOString(), id: last.id }) : null,
  })
})

jobsRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = parse(idParam, req.params.id)
  const worker = req.user?.role === 'worker' ? req.user.id : null
  const [job] = await query(
    `SELECT j.id, j.title, j.description, j.category, j.city, j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
            j.shift, j.openings, j.skills, j.is_open AS "isOpen", j.created_at AS "createdAt",
            c.name AS company,
            (SELECT count(*)::int FROM applications a WHERE a.job_id = j.id) AS "applicantCount",
            (SELECT a.status FROM applications a WHERE a.job_id = j.id AND a.worker_id = $2) AS "myStatus"
     FROM jobs j JOIN companies c ON c.id = j.company_id
     WHERE j.id = $1`,
    [id, worker],
  )
  if (!job) throw notFound('Job')
  res.json({ job })
})

/**
 * Apply in one tap. The UNIQUE (job_id, worker_id) constraint makes this
 * safe even if the button is pressed twice on a flaky connection: the second
 * insert does nothing and the worker gets a clear 409.
 */
jobsRouter.post('/:id/apply', requireAuth('worker'), async (req, res) => {
  const jobId = parse(idParam, req.params.id)
  const workerId = currentUser(req).id

  const application = await withTransaction(async (db) => {
    // FOR SHARE stops the job being closed while this application is being written.
    const {
      rows: [job],
    } = await db.query<{ is_open: boolean }>('SELECT is_open FROM jobs WHERE id = $1 FOR SHARE', [jobId])
    if (!job) throw notFound('Job')
    if (!job.is_open) throw new HttpError(410, 'This job is no longer accepting applications')

    const {
      rows: [app],
    } = await db.query<{ id: number; status: string; created_at: Date }>(
      `INSERT INTO applications (job_id, worker_id) VALUES ($1, $2)
       ON CONFLICT (job_id, worker_id) DO NOTHING
       RETURNING id, status, created_at`,
      [jobId, workerId],
    )
    if (!app) throw new HttpError(409, 'You have already applied for this job')
    await db.query(
      `INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES ($1, NULL, 'applied', $2)`,
      [app.id, workerId],
    )
    return app
  })

  res.status(201).json({ application })
})
