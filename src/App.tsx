import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout } from './services/auth'

const AdminPage = lazy(() => import('./pages/dashboard/AdminPage'))
const GlobalPage = lazy(() => import('./pages/global/GlobalPage'))
const ChartsPage = lazy(() => import('./pages/global/charts/ChartsPage'))
const WeeklyOverviewPage = lazy(() => import('./pages/global/WeeklyOverviewPage'))
const SalariesPage = lazy(() => import('./pages/global/SalariesPage'))
const WeeklyChartsPage = lazy(() => import('./pages/global/WeeklyChartsPage'))
const ExpensesPage = lazy(() => import('./pages/global/ExpensesPage'))
const ProceduresStatsPage = lazy(() => import('./pages/global/ProceduresStatsPage'))
const VoucherConfirmationPage = lazy(() => import('./pages/voucher-confirmation/VoucherConfirmationPage'))
const EmailCampaignPage = lazy(() => import('./pages/email-campaign/EmailCampaignPage'))
const AdministratorCabinetPage = lazy(() => import('./pages/administrator/AdministratorCabinetPage'))
const NoonaServicePage = lazy(() => import('./pages/global/NoonaServicePage'))
const NoonaActivityPage = lazy(() => import('./pages/global/NoonaActivityPage'))
const ShiftClosePage = lazy(() => import('./pages/global/ShiftClosePage'))
const BlogAIPage = lazy(() => import('./pages/global/BlogAIPage'))
const ReviewSyncPage = lazy(() => import('./pages/global/ReviewSyncPage'))
const MasterPriorityPage = lazy(() => import('./pages/global/MasterPriorityPage'))

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
  const userRole = localStorage.getItem('userRole')
  const isAuthenticated = userRole !== null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов мастера
const MasterRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = localStorage.getItem('userRole')
  const isMaster = userRole === 'master'

  if (!isMaster) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов администраторов
const AdministratorRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = localStorage.getItem('userRole')
  const isAdministrator = userRole === 'administrator'

  if (!isAdministrator) {
    return <Navigate to={getHomePageByRole(userRole)} replace />
  }

  return <>{children}</>
}

// Компонент для защиты маршрутов владельца
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = localStorage.getItem('userRole')
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
            path="/global/charts"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ChartsPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/weekly-overview"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <WeeklyOverviewPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/salaries"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <SalariesPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
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
            path="/global/weekly-charts"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <WeeklyChartsPage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/procedures-stats"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <ProceduresStatsPage />
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
            path="/global/noona-services"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <NoonaServicePage />
                  </AdminLayout>
                </OwnerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/noona-activity"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <NoonaActivityPage />
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
            path="/global/master-priority"
            element={
              <ProtectedRoute>
                <OwnerRoute>
                  <AdminLayout>
                    <MasterPriorityPage />
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
