import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Applicant, EmployerJob, JobDetail, JobSummary, Meta, MyApplication, Page, Stats, Status } from '../lib/types'

export interface JobFilters {
  q: string
  city: string
  category: string
  shift: string
  minSalary: string
}

export const useMeta = () =>
  useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/meta'), staleTime: Infinity })

/** Infinite job feed over the API's keyset cursor. Keeps old results on screen while new filters load. */
export function useJobFeed(filters: JobFilters) {
  return useInfiniteQuery({
    queryKey: ['jobs', 'feed', filters],
    queryFn: ({ pageParam }) => api<Page<JobSummary>>('/jobs', { query: { ...filters, cursor: pageParam, limit: 20 } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  })
}

export const useJob = (id: number) =>
  useQuery({ queryKey: ['jobs', 'detail', id], queryFn: () => api<{ job: JobDetail }>(`/jobs/${id}`).then((r) => r.job) })

export function useApply(jobId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api(`/jobs/${jobId}/apply`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      void qc.invalidateQueries({ queryKey: ['my-applications'] })
    },
  })
}

export const useMyApplications = () =>
  useQuery({ queryKey: ['my-applications'], queryFn: () => api<{ items: MyApplication[] }>('/me/applications').then((r) => r.items) })

export const useEmployerStats = () =>
  useQuery({ queryKey: ['employer', 'stats'], queryFn: () => api<Stats>('/employer/stats') })

export const useEmployerJobs = () =>
  useQuery({ queryKey: ['employer', 'jobs'], queryFn: () => api<{ items: EmployerJob[] }>('/employer/jobs').then((r) => r.items) })

export function useToggleJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isOpen }: { id: number; isOpen: boolean }) => api(`/employer/jobs/${id}`, { method: 'PATCH', body: { isOpen } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer'] }),
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ job: { id: number } }>('/employer/jobs', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employer'] })
      void qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

interface ApplicantsData {
  job: { id: number; title: string; city: string; openings: number; isOpen: boolean; skills: string[]; hired: number }
  items: Applicant[]
}

export const useApplicants = (jobId: number) =>
  useQuery({ queryKey: ['employer', 'applicants', jobId], queryFn: () => api<ApplicantsData>(`/employer/jobs/${jobId}/applicants`) })

/**
 * Moves an applicant to a new stage optimistically: the card jumps columns
 * immediately, and snaps back if the server says no (e.g. openings filled).
 */
export function useMoveApplicant(jobId: number) {
  const qc = useQueryClient()
  const key = ['employer', 'applicants', jobId]
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) =>
      api<{ jobClosed: boolean }>(`/employer/applications/${id}`, { method: 'PATCH', body: { status } }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ApplicantsData>(key)
      qc.setQueryData<ApplicantsData>(key, (d) =>
        d && { ...d, items: d.items.map((a) => (a.id === id ? { ...a, status } : a)) },
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['employer'] }),
  })
}
