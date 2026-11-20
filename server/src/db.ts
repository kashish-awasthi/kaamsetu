import pg from 'pg'
import { config } from './config.js'

// BIGSERIAL ids come back as strings by default; they fit safely in a JS number for this app.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v))

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.isServerless ? 3 : 10,
  ssl: config.databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
})

export type Db = Pick<pg.PoolClient, 'query'>

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query<T>(text, params)
  return rows
}

/**
 * Runs `fn` inside a transaction on a single connection. Commits on success,
 * rolls back on any error and always returns the connection to the pool.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Postgres error codes we turn into friendly HTTP responses. */
export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
} as const

export function isPgError(err: unknown, code: string): err is pg.DatabaseError {
  return err instanceof pg.DatabaseError && err.code === code
}
