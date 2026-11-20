import { useId, useState, type KeyboardEvent } from 'react'

interface SkillsInputProps {
  label: string
  value: string[]
  onChange: (skills: string[]) => void
  suggestions?: string[]
  error?: string
}

/** Type a skill and press Enter or comma to add it; tap a chip to remove it. */
export function SkillsInput({ label, value, onChange, suggestions = [], error }: SkillsInputProps) {
  const id = useId()
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const skill = raw.trim().toLowerCase()
    if (skill.length >= 2 && !value.includes(skill) && value.length < 15) onChange([...value, skill])
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 8)

  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="skills-box">
        {value.map((s) => (
          <button key={s} type="button" className="chip on" onClick={() => onChange(value.filter((v) => v !== s))} aria-label={`Remove ${s}`}>
            {s} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : 'e.g. two-wheeler, cooking'}
        />
      </div>
      {unused.length > 0 && (
        <div className="suggestions" aria-label="Suggested skills">
          {unused.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
