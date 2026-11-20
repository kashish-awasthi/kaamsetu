import { Link } from 'react-router'
import { StatusSteps } from '../components/StatusSteps'
import { Empty, ErrorBox, Spinner, StatusBadge } from '../components/ui'
import { useMyApplications } from '../hooks/queries'
import { formatSalary } from '../lib/format'
import { useT } from '../lib/i18n'

export function MyApplicationsPage() {
  const { t } = useT()
  const apps = useMyApplications()

  if (apps.isPending) return <Spinner />
  if (apps.isError) return <ErrorBox error={apps.error} onRetry={() => void apps.refetch()} />

  return (
    <div className="applications-page">
      <h1>{t('myApplications')}</h1>
      {apps.data.length === 0 ? (
        <Empty
          action={
            <Link to="/" className="btn">
              {t('findJobs')}
            </Link>
          }
        >
          {t('noApplications')}
        </Empty>
      ) : (
        <ul className="application-list">
          {apps.data.map((a) => (
            <li key={a.id} className="application-card">
              <div className="application-head">
                <div>
                  <Link to={`/jobs/${a.job.id}`}>
                    <h3>{a.job.title}</h3>
                  </Link>
                  <p className="muted">
                    {a.job.company} · {a.job.city} · {formatSalary(a.job.salaryMin, a.job.salaryMax)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <StatusSteps timeline={a.timeline} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
