import { dateTime } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Status } from '../lib/types'

const PATH: Status[] = ['applied', 'shortlisted', 'interview', 'hired']

/**
 * Shows where an application is in the hiring path, with the date each step
 * happened. A rejection replaces the steps not reached.
 */
export function StatusSteps({ timeline }: { timeline: { status: Status; at: string }[] }) {
  const { t } = useT()
  const reached = new Map(timeline.map((e) => [e.status, e.at]))
  const rejectedAt = reached.get('rejected')
  const lastPositive = PATH.filter((s) => reached.has(s)).at(-1)
  const steps = rejectedAt ? [...PATH.slice(0, PATH.indexOf(lastPositive ?? 'applied') + 1), 'rejected' as const] : PATH

  return (
    <ol className="steps">
      {steps.map((s) => {
        const at = reached.get(s)
        const state = s === 'rejected' ? 'rejected' : at ? 'done' : 'todo'
        return (
          <li key={s} className={`step ${state}`} aria-current={s === timeline.at(-1)?.status ? 'step' : undefined}>
            <span className="dot" aria-hidden />
            <span className="step-label">{t(`status_${s}`)}</span>
            {at && <span className="step-date">{dateTime(at)}</span>}
          </li>
        )
      })}
    </ol>
  )
}
