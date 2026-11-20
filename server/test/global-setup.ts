import pg from 'pg'

/** Rebuilds the test database schema from the real migrations before the suite runs. */
export default async function setup() {
  process.env.NODE_ENV = 'test'
  const url = process.env.DATABASE_URL ?? 'postgres://localhost:5432/kaamsetu_test'
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.end()

  process.env.DATABASE_URL = url
  const { migrate } = await import('../db/migrate.js')
  const { pool } = await import('../src/db.js')
  await migrate({ log: false })
  await pool.end()
}
