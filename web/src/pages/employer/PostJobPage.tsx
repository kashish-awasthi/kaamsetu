import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { SkillsInput } from '../../components/SkillsInput'
import { SelectField, TextAreaField, TextField } from '../../components/ui'
import { useCreateJob, useMeta } from '../../hooks/queries'
import { ApiError } from '../../lib/api'
import { capitalize } from '../../lib/format'

const INITIAL = { title: '', category: '', city: '', salaryMin: '', salaryMax: '', shift: 'day', openings: '1', description: '' }

export function PostJobPage() {
  const navigate = useNavigate()
  const meta = useMeta()
  const create = useCreateJob()
  const [form, setForm] = useState(INITIAL)
  const [skills, setSkills] = useState<string[]>([])
  const set = (k: keyof typeof INITIAL) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fields = create.error instanceof ApiError ? create.error.fields : {}

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(
      { ...form, salaryMin: Number(form.salaryMin), salaryMax: Number(form.salaryMax), openings: Number(form.openings), skills },
      { onSuccess: ({ job }) => navigate(`/employer/jobs/${job.id}`) },
    )
  }

  return (
    <div className="form-page">
      <h1>Post a job</h1>
      <form onSubmit={submit} noValidate className="job-form">
        <TextField label="Job title" placeholder="e.g. Delivery Partner" value={form.title} onChange={set('title')} error={fields.title} />
        <div className="row-2">
          <SelectField label="Category" value={form.category} onChange={set('category')} error={fields.category}>
            <option value="">Choose…</option>
            {meta.data?.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="City" value={form.city} onChange={set('city')} error={fields.city}>
            <option value="">Choose…</option>
            {meta.data?.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectField>
        </div>
        <div className="row-2">
          <TextField label="Salary from (₹/month)" type="number" inputMode="numeric" value={form.salaryMin} onChange={set('salaryMin')} error={fields.salaryMin} />
          <TextField label="Salary up to (₹/month)" type="number" inputMode="numeric" value={form.salaryMax} onChange={set('salaryMax')} error={fields.salaryMax} />
        </div>
        <div className="row-2">
          <SelectField label="Shift" value={form.shift} onChange={set('shift')} error={fields.shift}>
            {meta.data?.shifts.map((s) => (
              <option key={s} value={s}>
                {capitalize(s)}
              </option>
            ))}
          </SelectField>
          <TextField label="Openings" type="number" min={1} value={form.openings} onChange={set('openings')} error={fields.openings} />
        </div>
        <SkillsInput label="Skills needed" value={skills} onChange={setSkills} error={fields.skills} suggestions={['two-wheeler', 'driving licence', 'smartphone', 'hindi', 'english']} />
        <TextAreaField label="Job description" rows={5} placeholder="Work hours, location, weekly off, benefits…" value={form.description} onChange={set('description')} error={fields.description} />
        {create.error && !Object.keys(fields).length && <p className="form-error">{create.error.message}</p>}
        <button type="submit" className="btn big" disabled={create.isPending}>
          {create.isPending ? 'Posting…' : 'Post job'}
        </button>
      </form>
    </div>
  )
}
