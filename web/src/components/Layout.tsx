import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import type { Role } from '../lib/types'
import { Spinner } from './ui'

export function Layout() {
  const { user, signOut } = useAuth()
  const { t, lang, setLang } = useT()

  return (
    <div className="app">
      <header className="topbar">
        <Link to={user?.role === 'employer' ? '/employer' : '/'} className="brand">
          <span className="logo" aria-hidden>
            क
          </span>
          KaamSetu
        </Link>
        <nav className="nav">
          {user?.role === 'employer' ? (
            <>
              <NavLink to="/employer" end>
                Dashboard
              </NavLink>
              <NavLink to="/employer/jobs/new">Post a job</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end>
                {t('findJobs')}
              </NavLink>
              {user && <NavLink to="/applications">{t('myApplications')}</NavLink>}
            </>
          )}
        </nav>
        <div className="topbar-right">
          {user?.role !== 'employer' && (
            <button
              type="button"
              className="lang-toggle"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              aria-label={lang === 'en' ? 'हिंदी में देखें' : 'View in English'}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>
          )}
          {user ? (
            <div className="user-menu">
              <span className="user-name">{user.role === 'employer' ? user.companyName : user.name.split(' ')[0]}</span>
              <button type="button" className="btn ghost small" onClick={signOut}>
                {t('logout')}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn small">
              {t('login')}
            </Link>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

/** Route guard: sends logged-out users to login (and back afterwards), and wrong roles home. */
export function RequireRole({ role }: { role: Role }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={user.role === 'employer' ? '/employer' : '/'} replace />
  return <Outlet />
}
