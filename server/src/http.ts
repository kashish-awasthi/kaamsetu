import type { ErrorRequestHandler, RequestHandler } from 'express'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`)

/** Parses and validates part of a request; throws a 400 with field-level messages on failure. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join('.') || '_', i.message]))
    throw new HttpError(400, 'Please check the highlighted fields', { fields })
  }
  return result.data
}

export const idParam = z.coerce.number().int().positive()

export const unknownRoute: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'Route not found'))

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
}
