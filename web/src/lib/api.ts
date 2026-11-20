const TOKEN_KEY = 'kaamsetu.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable (private mode): stay logged in for this tab only */
    }
  },
}

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  details: Record<string, unknown>

  constructor(status: number, message: string, fields: Record<string, string> = {}, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.fields = fields
    this.details = details
  }
}

type Query = Record<string, string | number | undefined | null>

/** Thin fetch wrapper: JSON in and out, auth header, and errors turned into ApiError. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const url = new URL(`/api${path}`, window.location.origin)
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))

  const token = tokenStore.get()
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No internet connection. Please check your network and try again.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token) tokenStore.set(null)
    const details = (data?.details ?? {}) as Record<string, unknown>
    throw new ApiError(res.status, data?.error ?? 'Something went wrong', (details.fields ?? {}) as Record<string, string>, details)
  }
  return data as T
}
