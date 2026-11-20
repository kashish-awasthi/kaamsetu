import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { Layout, RequireRole } from './components/Layout'
import { Empty } from './components/ui'
import { ApiError } from './lib/api'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ApplicantsPage } from './pages/employer/ApplicantsPage'
import { DashboardPage } from './pages/employer/DashboardPage'
import { PostJobPage } from './pages/employer/PostJobPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { MyApplicationsPage } from './pages/MyApplicationsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network blips, but not 4xx answers that won't change on retry.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<JobsPage />} />
                <Route path="jobs/:id" element={<JobDetailPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route element={<RequireRole role="worker" />}>
                  <Route path="applications" element={<MyApplicationsPage />} />
                </Route>
                <Route path="employer" element={<RequireRole role="employer" />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="jobs/new" element={<PostJobPage />} />
                  <Route path="jobs/:id" element={<ApplicantsPage />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <Empty
                      action={
                        <Link to="/" className="btn">
                          Go home
                        </Link>
                      }
                    >
                      Page not found.
                    </Empty>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
