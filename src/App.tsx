import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout, getSessionRole } from './services/auth'
import { canAccessModule } from './moduleAccess'

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
const ClientDuplicatesPage = lazy(() => import('./pages/global/ClientDuplicatesPage'))
const LoyaltyPage = lazy(() => import('./pages/global/LoyaltyPage'))
// Unified analytics module — layout with URL sub-route tabs
const AnalyticsPage = lazy(() => import('./pages/global/analytics/AnalyticsPage'))
const AnalyticsOverviewTab = lazy(() => import('./pages/global/analytics/tabs/OverviewTab'))
const AnalyticsProceduresTab = lazy(() => import('./pages/global/analytics/tabs/ProceduresTab'))
const AnalyticsChartsTab = lazy(() => import('./pages/global/analytics/tabs/ChartsTab'))
const AnalyticsClientsTab = lazy(() => import('./pages/global/analytics/tabs/ClientsTab'))
const AnalyticsSleepingTab = lazy(() => import('./pages/global/analytics/tabs/SleepingTab'))
const AnalyticsComebackTab = lazy(() => import('./pages/global/analytics/tabs/ComebackTab'))
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
const TeamTaxesTab = lazy(() => import('./pages/global/team/tabs/TaxesTab'))
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

// Гейт модульных роутов: роли берутся из ЕДИНОГО реестра src/moduleAccess.ts —
// открыть/закрыть модуль для роли = поправить массив roles там (роуты трогать не надо)
const ModuleRoute = ({ module, children }: { module: string; children: React.ReactNode }) => {
  const userRole = getSessionRole()

  if (!canAccessModule(module, userRole)) {
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
                <ModuleRoute module="/calendar">
                  <AdminLayout bare>
                    <CalendarPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/catalog"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/catalog">
                  <AdminLayout>
                    <CatalogPage />
                  </AdminLayout>
                </ModuleRoute>
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
                <ModuleRoute module="/global/analytics">
                  <AdminLayout>
                    <AnalyticsPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/global/analytics/forecast" replace />} />
            <Route path="overview" element={<AnalyticsOverviewTab />} />
            <Route path="procedures" element={<AnalyticsProceduresTab />} />
            <Route path="charts" element={<AnalyticsChartsTab />} />
            <Route path="clients" element={<AnalyticsClientsTab />} />
            <Route path="sleeping" element={<AnalyticsSleepingTab />} />
            <Route path="comeback" element={<AnalyticsComebackTab />} />
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
                <ModuleRoute module="/global/team">
                  <AdminLayout>
                    <TeamPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/global/team/salaries" replace />} />
            <Route path="salaries" element={<TeamSalariesTab />} />
            <Route path="priority" element={<TeamPriorityTab />} />
            <Route path="time-off" element={<TeamTimeOffTab />} />
            <Route path="taxes" element={<TeamTaxesTab />} />
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
                <ModuleRoute module="/global/expenses">
                  <AdminLayout>
                    <ExpensesPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/voucher-confirmation"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/voucher-confirmation">
                  <AdminLayout>
                    <VoucherConfirmationPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-campaign"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/email-campaign">
                  <AdminLayout>
                    <EmailCampaignPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/shift-close"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/shift-close">
                  <AdminLayout>
                    <ShiftClosePage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/blog-ai"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/blog-ai">
                  <AdminLayout>
                    <BlogAIPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/reviews"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/reviews">
                  <AdminLayout>
                    <ReviewSyncPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/error-logs"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/error-logs">
                  <AdminLayout>
                    <ErrorLogsPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/client-duplicates"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/client-duplicates">
                  <AdminLayout>
                    <ClientDuplicatesPage />
                  </AdminLayout>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/loyalty"
            element={
              <ProtectedRoute>
                <ModuleRoute module="/global/loyalty">
                  <AdminLayout>
                    <LoyaltyPage />
                  </AdminLayout>
                </ModuleRoute>
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
