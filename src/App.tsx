import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import AdminPage from './pages/dashboard/AdminPage'
import GlobalPage from './pages/global/GlobalPage'
import ChartsPage from './pages/global/charts/ChartsPage'
import VoucherConfirmationPage from './pages/voucher-confirmation/VoucherConfirmationPage'
import EmailCampaignPage from './pages/email-campaign/EmailCampaignPage'
import AdministratorCabinetPage from './pages/administrator/AdministratorCabinetPage'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout } from './services/auth'

// Компонент для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('userRole') !== null
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Компонент для защиты маршрутов администраторов
const AdministratorRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = localStorage.getItem('userRole')
  const isAdministrator = userRole === 'administrator'
  return isAdministrator ? <>{children}</> : <Navigate to="/" replace />
}

// Компонент для защиты маршрутов владельца
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const userRole = localStorage.getItem('userRole')
  const isOwner = userRole === 'owner'
  return isOwner ? <>{children}</> : <Navigate to="/" replace />
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
                <AdminLayout>
                  <AdminPage />
                </AdminLayout>
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
