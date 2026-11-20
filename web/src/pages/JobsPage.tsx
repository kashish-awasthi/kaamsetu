import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { JobCard } from '../components/JobCard'
import { Empty, ErrorBox, Spinner } from '../components/ui'
import { useJobFeed, useMeta, type JobFilters } from '../hooks/queries'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

const SALARY_STEPS = [10000, 15000, 20000, 25000, 30000]
const KEYS = ['city', 'category', 'shift', 'minSalary'] as const

export function JobsPage() {
  const { t } = useT()
  const { user } = useAuth()
  const meta = useMeta()
  const [params, setParams] = useSearchParams()

  // Filters live in the URL so a search can be shared over WhatsApp and survives a refresh.
  const [text, setText] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(text.trim(), 300)
  useEffect(() => {
    setParams(
      (p) => {
        if (q) p.set('q', q)
        else p.delete('q')
        return p
      },
      { replace: true },
    )
  }, [q, setParams])

  const filters: JobFilters = useMemo(
    () => ({
      q,
      city: params.get('city') ?? '',
      category: params.get('category') ?? '',
      shift: params.get('shift') ?? '',
      minSalary: params.get('minSalary') ?? '',
    }),
    [q, params],
  )
  const setFilter = (key: (typeof KEYS)[number], value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  const feed = useJobFeed(filters)
  const jobs = feed.data?.pages.flatMap((p) => p.items) ?? []

  // Load the next page automatically when the user nears the bottom of the list.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const activeFilters = KEYS.filter((k) => params.get(k)).length

  return (
    <div className="jobs-page">
      <section className="hero">
        <h1>{t('findJobs')}</h1>
        {user?.role === 'worker' && user.city && (
          <p className="muted">
            Namaste {user.name.split(' ')[0]} 👋 {user.skills?.length ? `· ${user.skills.join(', ')}` : ''}
          </p>
        )}
        <label className="search">
          <span className="sr-only">{t('searchPlaceholder')}</span>
          <span aria-hidden className="search-icon">
            🔍
          </span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('searchPlaceholder')} />
        </label>

        <div className="filters">
          <select aria-label="City" value={filters.city} onChange={(e) => setFilter('city', e.target.value)}>
            <option value="">{t('allCities')}</option>
            {meta.data?.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Job type" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">{t('allCategories')}</option>
            {meta.data?.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <select aria-label="Shift" value={filters.shift} onChange={(e) => setFilter('shift', e.target.value)}>
            <option value="">{t('anyShift')}</option>
            {meta.data?.shifts.map((s) => (
              <option key={s} value={s}>
                {t(`shift_${s}`)}
              </option>
            ))}
          </select>
          <select aria-label={t('minSalary')} value={filters.minSalary} onChange={(e) => setFilter('minSalary', e.target.value)}>
            <option value="">
              {t('minSalary')}: {t('any')}
            </option>
            {SALARY_STEPS.map((s) => (
              <option key={s} value={s}>
                ₹{s.toLocaleString('en-IN')}+
              </option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setParams(q ? { q } : {}, { replace: true })}>
              Clear ({activeFilters})
            </button>
          )}
        </div>
      </section>

      {feed.isPending ? (
        <Spinner label="Loading jobs" />
      ) : feed.isError ? (
        <ErrorBox error={feed.error} onRetry={() => void feed.refetch()} />
      ) : jobs.length === 0 ? (
        <Empty>{t('noJobs')}</Empty>
      ) : (
        <>
          <div className={`job-list${feed.isPlaceholderData ? ' stale' : ''}`} aria-busy={feed.isFetching}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <div ref={sentinel} />
          {hasNextPage && (
            <button type="button" className="btn ghost wide" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? '…' : t('loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
