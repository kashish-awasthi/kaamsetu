import { Link } from 'react-router'
import { Empty, ErrorBox, Spinner } from '../../components/ui'
import { useEmployerJobs, useEmployerStats, useToggleJob } from '../../hooks/queries'
import { useAuth } from '../../lib/auth'
import { formatSalary, timeAgo } from '../../lib/format'
import { STATUSES } from '../../lib/types'

export function DashboardPage() {
  const { user } = useAuth()
  const stats = useEmployerStats()
  const jobs = useEmployerJobs()
  const toggle = useToggleJob()

  return (
    <div className="dashboard">
      <header className="page-head">
        <div>
          <h1>{user?.companyName}</h1>
          <p className="muted">Your jobs and hiring pipeline</p>
        </div>
        <Link to="/employer/jobs/new" className="btn">
          + Post a job
        </Link>
      </header>

      {stats.data && (
        <div className="stat-row">
          <div className="stat-tile">
            <span className="label">Open jobs</span>
            <strong>{stats.data.jobs.open}</strong>
          </div>
          <div className="stat-tile">
            <span className="label">Openings to fill</span>
            <strong>{stats.data.jobs.openings}</strong>
          </div>
          <div className="stat-tile">
            <span className="label">New applicants (7 days)</span>
            <strong>{stats.data.newThisWeek}</strong>
          </div>
          <div className="stat-tile">
            <span className="label">Hired</span>
            <strong>{stats.data.pipeline.hired}</strong>
          </div>
        </div>
      )}

      {jobs.isPending ? (
        <Spinner />
      ) : jobs.isError ? (
        <ErrorBox error={jobs.error} onRetry={() => void jobs.refetch()} />
      ) : jobs.data.length === 0 ? (
        <Empty
          action={
            <Link to="/employer/jobs/new" className="btn">
              Post your first job
            </Link>
          }
        >
          You haven't posted any jobs yet.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th scope="col">Job</th>
                {STATUSES.map((s) => (
                  <th key={s} scope="col" className="num">
                    {s[0]!.toUpperCase() + s.slice(1)}
                  </th>
                ))}
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.map((j) => (
                <tr key={j.id} className={j.isOpen ? '' : 'closed'}>
                  <td>
                    <Link to={`/employer/jobs/${j.id}`} className="job-link">
                      {j.title}
                    </Link>
                    <span className="muted small">
                      {j.city} · {formatSalary(j.salaryMin, j.salaryMax)} · {j.openings} openings · {timeAgo(j.createdAt)}
                    </span>
                  </td>
                  {STATUSES.map((s) => (
                    <td key={s} className={`num${j.pipeline[s] ? '' : ' zero'}`}>
                      {j.pipeline[s]}
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className={`toggle${j.isOpen ? ' on' : ''}`}
                      aria-pressed={j.isOpen}
                      disabled={toggle.isPending && toggle.variables?.id === j.id}
                      onClick={() => toggle.mutate({ id: j.id, isOpen: !j.isOpen })}
                    >
                      {j.isOpen ? 'Open' : 'Closed'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
