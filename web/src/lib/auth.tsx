import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { api, tokenStore } from './api'
import type { User } from './types'

interface Auth {
  user: User | null
  isLoading: boolean
  signIn: (token: string, user: User) => void
  signOut: () => void
}

const AuthContext = createContext<Auth | null>(null)

/**
 * The token lives in localStorage; the user profile is server state, fetched
 * once with TanStack Query and shared everywhere through context.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: User }>('/auth/me').then((r) => r.user),
    enabled: Boolean(tokenStore.get()),
    retry: false,
    staleTime: Infinity,
  })

  const signIn = useCallback(
    (token: string, user: User) => {
      tokenStore.set(token)
      qc.setQueryData(['me'], user)
      // Job lists include per-user fields (applied, matched skills), so refetch them.
      void qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    [qc],
  )

  const signOut = useCallback(() => {
    tokenStore.set(null)
    qc.setQueryData(['me'], null)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'meta' && q.queryKey[0] !== 'me' })
  }, [qc])

  const value = useMemo<Auth>(
    () => ({ user: tokenStore.get() ? (data ?? null) : null, isLoading: isLoading && Boolean(tokenStore.get()), signIn, signOut }),
    [data, isLoading, signIn, signOut],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
