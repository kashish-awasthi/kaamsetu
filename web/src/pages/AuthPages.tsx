import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { SkillsInput } from '../components/SkillsInput'
import { SelectField, TextField } from '../components/ui'
import { useMeta } from '../hooks/queries'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import type { Role, User } from '../lib/types'

const COMMON_SKILLS = ['two-wheeler', 'driving licence', 'smartphone', 'hindi', 'english', 'cooking', 'packing', 'customer service', 'wiring', 'night shift']

/** After login, go back to the page that asked for it (e.g. the job they wanted to apply to). */
function useAfterAuth() {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  return (user: User) => navigate(from ?? (user.role === 'employer' ? '/employer' : '/'), { replace: true })
}

export function LoginPage() {
  const { t } = useT()
  const { user, signIn } = useAuth()
  const done = useAfterAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: (body: { phone: string; password: string }) => api<{ token: string; user: User }>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ token, user }) => {
      signIn(token, user)
      done(user)
    },
  })

  if (user) return <Navigate to={user.role === 'employer' ? '/employer' : '/'} replace />
  const fields = login.error instanceof ApiError ? login.error.fields : {}

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ phone, password })
  }

  return (
    <div className="auth-card">
      <h1>{t('login')}</h1>
      <form onSubmit={submit} noValidate>
        <TextField label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} error={fields.phone} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        {login.error && !Object.keys(fields).length && (
          <p className="form-error" role="alert">
            {login.error.message}
          </p>
        )}
        <button type="submit" className="btn big wide" disabled={login.isPending}>
          {login.isPending ? '…' : t('login')}
        </button>
      </form>

      <div className="demo-logins">
        <p className="muted small">Try a demo account:</p>
        <button type="button" className="btn ghost small" onClick={() => login.mutate({ phone: '9000000001', password: 'demo1234' })}>
          Worker demo
        </button>
        <button type="button" className="btn ghost small" onClick={() => login.mutate({ phone: '9000000002', password: 'demo1234' })}>
          Employer demo
        </button>
      </div>
      <p className="switch">
        New here? <Link to="/register">{t('register')}</Link>
      </p>
    </div>
  )
}

export function RegisterPage() {
  const { t } = useT()
  const { user, signIn } = useAuth()
  const done = useAfterAuth()
  const meta = useMeta()
  const [role, setRole] = useState<Role>('worker')
  const [form, setForm] = useState({ name: '', phone: '', password: '', city: '', companyName: '', experienceYears: '0' })
  const [skills, setSkills] = useState<string[]>([])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const register = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ token: string; user: User }>('/auth/register', { method: 'POST', body }),
    onSuccess: ({ token, user }) => {
      signIn(token, user)
      done(user)
    },
  })

  if (user) return <Navigate to="/" replace />
  const fields = register.error instanceof ApiError ? register.error.fields : {}

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const base = { role, name: form.name, phone: form.phone, password: form.password }
    register.mutate(
      role === 'worker'
        ? { ...base, city: form.city, skills, experienceYears: Number(form.experienceYears) }
        : { ...base, companyName: form.companyName },
    )
  }

  return (
    <div className="auth-card">
      <h1>{t('register')}</h1>
      <div className="role-tabs" role="tablist" aria-label="I am">
        {(['worker', 'employer'] as const).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
            {r === 'worker' ? '👷 I want a job' : '🏢 I want to hire'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} noValidate>
        <TextField label="Your name" autoComplete="name" value={form.name} onChange={set('name')} error={fields.name} />
        <TextField label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} error={fields.phone} />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={fields.password} hint="At least 8 characters" />
        {role === 'worker' ? (
          <>
            <SelectField label="City" value={form.city} onChange={set('city')} error={fields.city}>
              <option value="">Choose your city</option>
              {meta.data?.cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <SkillsInput label="Your skills" value={skills} onChange={setSkills} suggestions={COMMON_SKILLS} error={fields.skills} />
            <TextField label="Years of experience" type="number" min={0} max={50} value={form.experienceYears} onChange={set('experienceYears')} error={fields.experienceYears} />
          </>
        ) : (
          <TextField label="Company name" value={form.companyName} onChange={set('companyName')} error={fields.companyName} />
        )}
        {register.error && !Object.keys(fields).length && (
          <p className="form-error" role="alert">
            {register.error.message}
          </p>
        )}
        <button type="submit" className="btn big wide" disabled={register.isPending}>
          {register.isPending ? '…' : 'Create account'}
        </button>
      </form>
      <p className="switch">
        Already registered? <Link to="/login">{t('login')}</Link>
      </p>
    </div>
  )
}
