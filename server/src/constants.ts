export const CITIES = [
  'Bengaluru',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Noida',
  'Gurugram',
] as const

export const SHIFTS = ['day', 'night', 'rotational', 'flexible'] as const
export const APPLICATION_STATUSES = ['applied', 'shortlisted', 'interview', 'hired', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/**
 * The hiring pipeline as a state machine: which moves an employer may make
 * from each status. Hired and rejected are final.
 */
export const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['hired', 'rejected'],
  hired: [],
  rejected: [],
}
