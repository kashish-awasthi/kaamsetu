import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { useT } from '../lib/i18n'
import type { Status } from '../lib/types'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <div className="error-box" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn ghost small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useT()
  return <span className={`badge status-${status}`}>{t(`status_${status}`)}</span>
}

type FieldProps = { label: string; error?: string; hint?: string }

export function TextField({ label, error, hint, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-msg` : undefined} {...input} />
      {(error || hint) && (
        <p id={`${id}-msg`} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function SelectField({ label, error, children, ...select }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-msg` : undefined} {...select}>
        {children}
      </select>
      {error && (
        <p id={`${id}-msg`} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextAreaField({ label, error, ...area }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-msg` : undefined} {...area} />
      {error && (
        <p id={`${id}-msg`} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
