import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Applicant, JobSummary } from '../lib/types'
import { ApplicantRow } from '../pages/employer/ApplicantsPage'
import { renderWithProviders } from '../test/utils'
import { JobCard } from './JobCard'
import { SkillsInput } from './SkillsInput'
import { StatusSteps } from './StatusSteps'

const job: JobSummary = {
  id: 7,
  title: 'Delivery Partner',
  category: 'delivery',
  city: 'Bengaluru',
  salaryMin: 18000,
  salaryMax: 120000,
  shift: 'night',
  openings: 3,
  skills: ['two-wheeler', 'smartphone'],
  company: 'Swift Logistics',
  createdAt: new Date().toISOString(),
  matchedSkills: 1,
  applied: true,
}

describe('JobCard', () => {
  it('shows salary in Indian format, skill match and applied state, and links to the job', () => {
    renderWithProviders(<JobCard job={job} />)
    expect(screen.getByText('₹18,000 – ₹1,20,000')).toBeInTheDocument()
    expect(screen.getByText(/1\/2 of your skills match/)).toBeInTheDocument()
    expect(screen.getByText(/Applied/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/jobs/7')
  })

  it('renders in Hindi', () => {
    renderWithProviders(<JobCard job={job} />, { lang: 'hi' })
    expect(screen.getByText(/रात की शिफ्ट/)).toBeInTheDocument()
    expect(screen.getByText(/आवेदन किया/)).toBeInTheDocument()
  })

  it('hides the match badge for logged-out visitors', () => {
    renderWithProviders(<JobCard job={{ ...job, matchedSkills: null, applied: null }} />)
    expect(screen.queryByText(/skills match/)).not.toBeInTheDocument()
  })
})

describe('StatusSteps', () => {
  it('marks reached steps and shows a rejection after the last step reached', () => {
    renderWithProviders(
      <StatusSteps
        timeline={[
          { status: 'applied', at: '2026-11-01T10:00:00Z' },
          { status: 'shortlisted', at: '2026-11-02T10:00:00Z' },
          { status: 'rejected', at: '2026-11-03T10:00:00Z' },
        ]}
      />,
    )
    const steps = screen.getAllByRole('listitem')
    expect(steps.map((s) => s.className)).toEqual(['step done', 'step done', 'step rejected'])
    expect(within(steps[2]!).getByText('Not selected')).toBeInTheDocument()
  })
})

const applicant: Applicant = {
  id: 1,
  status: 'interview',
  appliedAt: new Date().toISOString(),
  name: 'Priya Nair',
  phone: '9876543210',
  city: 'Chennai',
  skills: ['cooking'],
  experienceYears: 4,
  matchedSkills: 1,
}

describe('ApplicantRow', () => {
  it('offers only the moves the pipeline allows', async () => {
    const onMove = vi.fn()
    renderWithProviders(<ApplicantRow applicant={applicant} onMove={onMove} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Hire', 'Reject'])
    await userEvent.click(screen.getByRole('button', { name: 'Hire' }))
    expect(onMove).toHaveBeenCalledWith('hired')
    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+919876543210')
  })

  it('hides Hire once every opening is filled', () => {
    renderWithProviders(<ApplicantRow applicant={applicant} onMove={vi.fn()} canHire={false} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Reject'])
  })
})

describe('SkillsInput', () => {
  it('adds skills on Enter, ignores duplicates, and removes on Backspace', async () => {
    const user = userEvent.setup()
    let value: string[] = []
    const onChange = vi.fn((v: string[]) => (value = v))
    const { rerender } = renderWithProviders(<SkillsInput label="Skills" value={value} onChange={onChange} />)
    const input = screen.getByLabelText('Skills')

    await user.type(input, 'Two-Wheeler{Enter}')
    expect(value).toEqual(['two-wheeler'])

    rerender(<SkillsInput label="Skills" value={value} onChange={onChange} />)
    await user.type(screen.getByLabelText('Skills'), 'two-wheeler{Enter}')
    expect(value).toEqual(['two-wheeler'])
  })
})
