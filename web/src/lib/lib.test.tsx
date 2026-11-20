import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { api, ApiError, tokenStore } from './api'
import { formatSalary, timeAgo } from './format'

describe('format', () => {
  it('formats salaries with Indian digit grouping', () => {
    expect(formatSalary(15000, 15000)).toBe('₹15,000')
    expect(formatSalary(95000, 125000)).toBe('₹95,000 – ₹1,25,000')
  })

  it('formats relative times', () => {
    const now = Date.parse('2026-11-20T12:00:00Z')
    expect(timeAgo('2026-11-20T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-11-19T12:00:00Z', now)).toBe('yesterday')
  })
})

describe('useDebouncedValue', () => {
  it('only updates after the value stops changing', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'd' } })
    rerender({ v: 'de' })
    rerender({ v: 'del' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('d')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('del')
    vi.useRealTimers()
  })
})

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStore.set(null)
  })

  it('sends the token and drops empty query params', async () => {
    tokenStore.set('abc')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api('/jobs', { query: { city: 'Pune', q: '', cursor: null } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.search).toBe('?city=Pune')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('turns error responses into ApiError with field messages, and clears an expired token', async () => {
    tokenStore.set('expired')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 })))
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 401, message: 'Session expired' })
    expect(tokenStore.get()).toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Check fields', details: { fields: { phone: 'Bad' } } }), { status: 400 })),
    )
    const err = await api('/auth/register', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).fields).toEqual({ phone: 'Bad' })
  })

  it('reports a friendly message when offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(api('/jobs')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/internet/) })
  })
})
