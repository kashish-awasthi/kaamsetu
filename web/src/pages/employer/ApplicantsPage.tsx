import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Empty, ErrorBox, Spinner } from '../../components/ui'
import { useApplicants, useMoveApplicant } from '../../hooks/queries'
import { capitalize, timeAgo } from '../../lib/format'
import { STATUSES, TRANSITIONS, type Applicant, type Status } from '../../lib/types'

const ACTION_LABEL: Record<Status, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlist',
  interview: 'Interview',
  hired: 'Hire',
  rejected: 'Reject',
}

export function ApplicantRow({ applicant, onMove, disabled, canHire = true }: { applicant: Applicant; onMove: (s: Status) => void; disabled?: boolean; canHire?: boolean }) {
  const a = applicant
  // Once every opening is filled, don't offer a Hire button that can only fail.
  const moves = TRANSITIONS[a.status].filter((to) => to !== 'hired' || canHire)
  return (
    <li className="applicant">
      <div className="applicant-main">
        <div className="avatar" aria-hidden>
          {a.name[0]}
        </div>
        <div>
          <h3>{a.name}</h3>
          <p className="muted small">
            {a.city} · {a.experienceYears} yrs experience · applied {timeAgo(a.appliedAt)}
          </p>
          <div className="chips small">
            {a.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </div>
        <span className={`match${a.matchedSkills > 0 ? ' good' : ''}`} title="Required skills this worker has">
          {a.matchedSkills} match
        </span>
      </div>
      <div className="applicant-actions">
        <a href={`tel:+91${a.phone}`} className="btn ghost small">
          📞 Call
        </a>
        {moves.map((to) => (
          <button key={to} type="button" className={`btn small ${to === 'rejected' ? 'danger' : ''}`} onClick={() => onMove(to)} disabled={disabled}>
            {ACTION_LABEL[to]}
          </button>
        ))}
      </div>
    </li>
  )
}

export function ApplicantsPage() {
  const jobId = Number(useParams().id)
  const data = useApplicants(jobId)
  const move = useMoveApplicant(jobId)
  const [tab, setTab] = useState<Status>('applied')

  if (data.isPending) return <Spinner />
  if (data.isError) return <ErrorBox error={data.error} onRetry={() => void data.refetch()} />

  const { job, items } = data.data
  const counts = Object.fromEntries(STATUSES.map((s) => [s, items.filter((a) => a.status === s).length])) as Record<Status, number>
  const shown = items.filter((a) => a.status === tab)

  return (
    <div className="applicants-page">
      <Link to="/employer" className="back">
        ← Dashboard
      </Link>
      <header className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p className="muted">
            {job.city} · Hired {job.hired} of {job.openings} · {job.isOpen ? 'Open' : 'Closed'}
          </p>
        </div>
      </header>

      {move.isError && (
        <p className="form-error" role="alert">
          {move.error.message}
        </p>
      )}
      {move.data?.jobClosed && <p className="notice">All openings are filled, so this job is now closed to new applicants. 🎉</p>}

      <div className="tabs" role="tablist" aria-label="Pipeline stage">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)}>
            {capitalize(s)} <span className="count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty>No applicants in this stage.</Empty>
      ) : (
        <ul className="applicant-list">
          {shown.map((a) => (
            <ApplicantRow
              key={a.id}
              applicant={a}
              disabled={move.isPending && move.variables?.id === a.id}
              canHire={counts.hired < job.openings}
              onMove={(status) => {
                move.reset()
                move.mutate({ id: a.id, status })
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
