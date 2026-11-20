export type Role = 'worker' | 'employer'
export type Shift = 'day' | 'night' | 'rotational' | 'flexible'
export const STATUSES = ['applied', 'shortlisted', 'interview', 'hired', 'rejected'] as const
export type Status = (typeof STATUSES)[number]

/** Mirrors the server's state machine so the UI only offers valid moves. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['hired', 'rejected'],
  hired: [],
  rejected: [],
}

export interface User {
  id: number
  role: Role
  name: string
  phone: string
  city: string | null
  skills: string[] | null
  experienceYears: number | null
  companyId: number | null
  companyName: string | null
}

export interface JobSummary {
  id: number
  title: string
  category: string
  city: string
  salaryMin: number
  salaryMax: number
  shift: Shift
  openings: number
  skills: string[]
  company: string
  createdAt: string
  matchedSkills: number | null
  applied: boolean | null
}

export interface JobDetail extends Omit<JobSummary, 'matchedSkills' | 'applied'> {
  description: string
  isOpen: boolean
  applicantCount: number
  myStatus: Status | null
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface Meta {
  cities: string[]
  shifts: Shift[]
  categories: { slug: string; label: string }[]
}

export interface MyApplication {
  id: number
  status: Status
  createdAt: string
  job: { id: number; title: string; city: string; company: string; salaryMin: number; salaryMax: number; isOpen: boolean }
  timeline: { status: Status; at: string }[]
}

export type Pipeline = Record<Status, number>

export interface EmployerJob {
  id: number
  title: string
  city: string
  category: string
  openings: number
  isOpen: boolean
  createdAt: string
  salaryMin: number
  salaryMax: number
  pipeline: Pipeline
  total: number
}

export interface Applicant {
  id: number
  status: Status
  appliedAt: string
  name: string
  phone: string
  city: string
  skills: string[]
  experienceYears: number
  matchedSkills: number
}

export interface Stats {
  jobs: { open: number; total: number; openings: number }
  pipeline: Pipeline
  newThisWeek: number
}
