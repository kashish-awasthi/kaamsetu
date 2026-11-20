const env = process.env

function required(name: string, fallback?: string): string {
  const value = env[name] ?? fallback
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

const isTest = env.NODE_ENV === 'test' || env.VITEST === 'true'

export const config = {
  isTest,
  isProduction: env.NODE_ENV === 'production',
  isServerless: Boolean(env.VERCEL),
  port: Number(env.PORT ?? 4000),
  databaseUrl: required(
    'DATABASE_URL',
    isTest ? 'postgres://localhost:5432/kaamsetu_test' : 'postgres://localhost:5432/kaamsetu',
  ),
  // A dev-only default keeps local setup to one command; production must set a real secret.
  jwtSecret: required('JWT_SECRET', env.NODE_ENV === 'production' ? undefined : 'dev-only-secret-change-me'),
  jwtTtl: '7d' as const,
}
