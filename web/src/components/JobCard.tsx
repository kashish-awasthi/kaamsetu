import { Link } from 'react-router'
import { formatSalary, timeAgo } from '../lib/format'
import { useT } from '../lib/i18n'
import type { JobSummary } from '../lib/types'

export function JobCard({ job }: { job: JobSummary }) {
  const { t } = useT()
  const needed = job.skills.length
  return (
    <Link to={`/jobs/${job.id}`} className="job-card">
      <div className="job-card-top">
        <div>
          <h3>{job.title}</h3>
          <p className="muted">{job.company}</p>
        </div>
        {job.applied && <span className="badge status-applied">✓ {t('applied')}</span>}
      </div>
      <p className="salary">
        {formatSalary(job.salaryMin, job.salaryMax)}
        <span className="muted">{t('perMonth')}</span>
      </p>
      <ul className="job-meta">
        <li>📍 {job.city}</li>
        <li>🕘 {t(`shift_${job.shift}`)}</li>
        <li>
          👥 {job.openings} {t('openings')}
        </li>
      </ul>
      <div className="job-card-bottom">
        {job.matchedSkills !== null && needed > 0 ? (
          <span className={`match${job.matchedSkills > 0 ? ' good' : ''}`}>
            {job.matchedSkills}/{needed} {t('skillsMatch')}
          </span>
        ) : (
          <span />
        )}
        <span className="muted small">{timeAgo(job.createdAt)}</span>
      </div>
    </Link>
  )
}
