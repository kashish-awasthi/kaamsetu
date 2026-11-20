import { Link, useNavigate, useParams } from 'react-router'
import { ErrorBox, Spinner, StatusBadge } from '../components/ui'
import { useApply, useJob } from '../hooks/queries'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatSalary, timeAgo } from '../lib/format'
import { useT } from '../lib/i18n'

export function JobDetailPage() {
  const id = Number(useParams().id)
  const { t } = useT()
  const { user } = useAuth()
  const navigate = useNavigate()
  const job = useJob(id)
  const apply = useApply(id)

  if (job.isPending) return <Spinner />
  if (job.isError) return <ErrorBox error={job.error} onRetry={() => void job.refetch()} />
  const j = job.data
  const mySkills = new Set(user?.skills ?? [])

  let action
  if (j.myStatus) {
    action = (
      <div className="applied-box">
        <StatusBadge status={j.myStatus} />
        <Link to="/applications">{t('myApplications')} →</Link>
      </div>
    )
  } else if (!j.isOpen) {
    action = <p className="muted">{t('jobClosed')}</p>
  } else if (!user) {
    action = (
      <button type="button" className="btn big" onClick={() => navigate('/login', { state: { from: `/jobs/${id}` } })}>
        {t('loginToApply')}
      </button>
    )
  } else if (user.role === 'worker') {
    action = (
      <>
        <button type="button" className="btn big" onClick={() => apply.mutate()} disabled={apply.isPending}>
          {apply.isPending ? t('applying') : t('apply')}
        </button>
        {apply.error instanceof ApiError && apply.error.status !== 409 && <p className="field-error">{apply.error.message}</p>}
      </>
    )
  }

  return (
    <article className="job-detail">
      <button type="button" className="back" onClick={() => navigate(-1)}>
        ← {t('back')}
      </button>
      <header>
        <h1>{j.title}</h1>
        <p className="muted">
          {j.company} · {j.city} · {timeAgo(j.createdAt)}
        </p>
      </header>

      <div className="detail-grid">
        <div className="stat-tile">
          <span className="label">Salary{t('perMonth')}</span>
          <strong>{formatSalary(j.salaryMin, j.salaryMax)}</strong>
        </div>
        <div className="stat-tile">
          <span className="label">Shift</span>
          <strong>{t(`shift_${j.shift}`)}</strong>
        </div>
        <div className="stat-tile">
          <span className="label">{t('openings')}</span>
          <strong>{j.openings}</strong>
        </div>
        <div className="stat-tile">
          <span className="label">{t('applicants')}</span>
          <strong>{j.applicantCount}</strong>
        </div>
      </div>

      {j.skills.length > 0 && (
        <section>
          <h2>{t('skillsNeeded')}</h2>
          <div className="chips">
            {j.skills.map((s) => (
              <span key={s} className={`chip${mySkills.has(s) ? ' have' : ''}`}>
                {mySkills.has(s) ? '✓ ' : ''}
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>{t('aboutJob')}</h2>
        <p className="description">{j.description}</p>
      </section>

      <div className="sticky-action">{action}</div>
    </article>
  )
}
