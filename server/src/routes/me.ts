import { Router } from 'express'
import { currentUser, requireAuth } from '../auth.js'
import { query } from '../db.js'

export const meRouter = Router()

/** A worker's applications, newest first, each with its full status timeline. */
meRouter.get('/applications', requireAuth('worker'), async (req, res) => {
  const items = await query(
    `SELECT a.id, a.status, a.created_at AS "createdAt", a.updated_at AS "updatedAt",
            json_build_object(
              'id', j.id, 'title', j.title, 'city', j.city, 'company', c.name,
              'salaryMin', j.salary_min, 'salaryMax', j.salary_max, 'isOpen', j.is_open
            ) AS job,
            COALESCE(
              (SELECT json_agg(json_build_object('status', e.to_status, 'at', e.created_at) ORDER BY e.created_at)
               FROM application_events e WHERE e.application_id = a.id),
              '[]'
            ) AS timeline
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE a.worker_id = $1
     ORDER BY a.created_at DESC
     LIMIT 100`,
    [currentUser(req).id],
  )
  res.json({ items })
})
