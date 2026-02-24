import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import AdminPage from './pages/dashboard/AdminPage'
import GlobalPage from './pages/global/GlobalPage'
import ChartsPage from './pages/global/charts/ChartsPage'
import WeeklyOverviewPage from './pages/global/WeeklyOverviewPage'
import SalariesPage from './pages/global/SalariesPage'
import WeeklyChartsPage from './pages/global/WeeklyChartsPage'
import ExpensesPage from './pages/global/ExpensesPage'
import ProceduresStatsPage from './pages/global/ProceduresStatsPage'
import VoucherConfirmationPage from './pages/voucher-confirmation/VoucherConfirmationPage'
import EmailCampaignPage from './pages/email-campaign/EmailCampaignPage'
import AdministratorCabinetPage from './pages/administrator/AdministratorCabinetPage'
import NoonaServicePage from './pages/global/NoonaServicePage'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout } from './services/auth'

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
      </Router>
    </AppProvider>
  )
}

export default App
