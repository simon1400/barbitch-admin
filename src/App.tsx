import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout, getSessionRole } from './services/auth'

const AdminPage = lazy(() => import('./pages/dashboard/AdminPage'))
const GlobalPage = lazy(() => import('./pages/global/GlobalPage'))
const ExpensesPage = lazy(() => import('./pages/global/ExpensesPage'))
const VoucherConfirmationPage = lazy(() => import('./pages/voucher-confirmation/VoucherConfirmationPage'))
const EmailCampaignPage = lazy(() => import('./pages/email-campaign/EmailCampaignPage'))
const AdministratorCabinetPage = lazy(() => import('./pages/administrator/AdministratorCabinetPage'))
const ShiftClosePage = lazy(() => import('./pages/global/ShiftClosePage'))
const BlogAIPage = lazy(() => import('./pages/global/BlogAIPage'))
const ReviewSyncPage = lazy(() => import('./pages/global/ReviewSyncPage'))
const ErrorLogsPage = lazy(() => import('./pages/global/ErrorLogsPage'))
// Unified analytics module — layout with URL sub-route tabs
const AnalyticsPage = lazy(() => import('./pages/global/analytics/AnalyticsPage'))
const AnalyticsOverviewTab = lazy(() => import('./pages/global/analytics/tabs/OverviewTab'))
const AnalyticsProceduresTab = lazy(() => import('./pages/global/analytics/tabs/ProceduresTab'))
const AnalyticsChartsTab = lazy(() => import('./pages/global/analytics/tabs/ChartsTab'))
const AnalyticsClientsTab = lazy(() => import('./pages/global/analytics/tabs/ClientsTab'))
const AnalyticsSleepingTab = lazy(() => import('./pages/global/analytics/tabs/SleepingTab'))
const AnalyticsRetentionTab = lazy(() => import('./pages/global/analytics/tabs/RetentionTab'))
const AnalyticsForecastTab = lazy(() => import('./pages/global/analytics/tabs/ForecastTab'))
const AnalyticsCancellationsTab = lazy(
  () => import('./pages/global/analytics/tabs/CancellationsTab'),
)
const AnalyticsVouchersTab = lazy(() => import('./pages/global/analytics/tabs/VouchersTab'))
const AnalyticsGlobalStatsTab = lazy(
  () => import('./pages/global/analytics/tabs/GlobalStatsTab'),
)
// Unified team module — layout with URL sub-route tabs
const TeamPage = lazy(() => import('./pages/global/team/TeamPage'))
const TeamSalariesTab = lazy(() => import('./pages/global/team/tabs/SalariesTab'))
const TeamPriorityTab = lazy(() => import('./pages/global/team/tabs/PriorityTab'))
const TeamTimeOffTab = lazy(() => import('./pages/global/team/tabs/TimeOffTab'))
const TeamLoadTab = lazy(() => import('./pages/global/team/tabs/LoadTab'))
const TeamGapsTab = lazy(() => import('./pages/global/team/tabs/GapsTab'))
const TeamCrossSellTab = lazy(() => import('./pages/global/team/tabs/CrossSellTab'))
// Own-booking (фаза 2, каркас): календарь по зеркалу Noona
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'))
// Own-booking (шаг 6.2): редактор собственного каталога услуг
const CatalogPage = lazy(() => import('./pages/global/catalog/CatalogPage'))

// Получить домашнюю страницу в зависимости от роли
const getHomePageByRole = (role: string | null): string => {
  switch (role) {
    case 'owner':
      return '/global'
    case 'administrator':
      return '/administrator-cabinet'
    case 'master':
      return '/'
    default:
      return '/login'
  }
}

// Компонент для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = getSessionRole()
  const isAuthenticated = userRole !== null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов мастера
const MasterRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = getSessionRole()
  const isMaster = userRole === 'master'

  if (!isMaster) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов администраторов
const AdministratorRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = getSessionRole()
  const isAdministrator = userRole === 'administrator'

  if (!isAdministrator) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

// Календарь: owner + administrator (полный доступ) + master (read-only, только свои брони —
// страница сама ограничивает по роли)
const CalendarRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = getSessionRole()
  const allowed = userRole === 'owner' || userRole === 'administrator' || userRole === 'master'

  if (!allowed) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов владельца
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = getSessionRole()
  const isOwner = userRole === 'owner'

  if (!isOwner) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

function App() {
  // Проверяем статус пользователя каждые 30 секунд
  useEffect(() => {
    const checkStatus = async () => {
      const userId = localStorage.getItem('userId')
      if (userId) {
        const status = await checkUserStatus(userId)
        if (status && !status.isActive) {
          console.log('User has been deactivated, logging out...')
          logout()
        }
      }
    }

    // Проверяем сразу при загрузке
    checkStatus()

    // Проверяем каждые 30 секунд
    const intervalId = setInterval(checkStatus, 30000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <AppProvider>
      <Router>
        <Suspense>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MasterRoute>
                  <AdminLayout>
                    <AdminPage />
                  </AdminLayout>
                </MasterRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <GlobalPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarRoute>
                  <AdminLayout bare>
                    <CalendarPage />
                  </AdminLayout>
                </CalendarRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/catalog"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <CatalogPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/charts"
            element={<Navigate to="/global/analytics" replace />}
          />
          <Route
            path="/global/analytics"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <AnalyticsPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/global/analytics/forecast" replace />} />
            <Route path="overview" element={<AnalyticsOverviewTab />} />
            <Route path="procedures" element={<AnalyticsProceduresTab />} />
            <Route path="charts" element={<AnalyticsChartsTab />} />
            <Route path="clients" element={<AnalyticsClientsTab />} />
            <Route path="sleeping" element={<AnalyticsSleepingTab />} />
            <Route path="retention" element={<AnalyticsRetentionTab />} />
            <Route path="forecast" element={<AnalyticsForecastTab />} />
            <Route path="global-stats" element={<AnalyticsGlobalStatsTab />} />
            <Route path="cancellations" element={<AnalyticsCancellationsTab />} />
            <Route path="vouchers" element={<AnalyticsVouchersTab />} />
          </Route>
          {/* Legacy URL redirects — old standalone analytics pages now live as tabs */}
          <Route
            path="/global/weekly-overview"
            element={<Navigate to="/global/analytics/overview" replace />}
          />
          <Route
            path="/global/procedures-stats"
            element={<Navigate to="/global/analytics/procedures" replace />}
          />
          <Route
            path="/global/weekly-charts"
            element={<Navigate to="/global/analytics/charts" replace />}
          />
          <Route
            path="/global/team"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <TeamPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/global/team/salaries" replace />} />
            <Route path="salaries" element={<TeamSalariesTab />} />
            <Route path="priority" element={<TeamPriorityTab />} />
            <Route path="time-off" element={<TeamTimeOffTab />} />
            <Route path="load" element={<TeamLoadTab />} />
            <Route path="gaps" element={<TeamGapsTab />} />
            <Route path="cross-sell" element={<TeamCrossSellTab />} />
          </Route>
          {/* Legacy URL redirects — old standalone pages now live as Team tabs */}
          <Route
            path="/global/salaries"
            element={<Navigate to="/global/team/salaries" replace />}
          />
          <Route
            path="/global/master-priority"
            element={<Navigate to="/global/team/priority" replace />}
          />
          <Route
            path="/global/expenses"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ExpensesPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/voucher-confirmation"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <VoucherConfirmationPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-campaign"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <EmailCampaignPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/shift-close"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ShiftClosePage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/blog-ai"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <BlogAIPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/reviews"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ReviewSyncPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/error-logs"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ErrorLogsPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/administrator-cabinet"
            element={
              <ProtectedRoute>
                <AdministratorRoute>
                  <AdminLayout>
                    <AdministratorCabinetPage />
                  </AdminLayout>
                </AdministratorRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </Router>
    </AppProvider>
  )
}

export default App
