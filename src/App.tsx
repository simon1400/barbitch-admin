import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import AdminPage from './pages/dashboard/AdminPage'
import GlobalPage from './pages/global/GlobalPage'
import ChartsPage from './pages/global/charts/ChartsPage'
import VoucherConfirmationPage from './pages/voucher-confirmation/VoucherConfirmationPage'
import EmailCampaignPage from './pages/email-campaign/EmailCampaignPage'
import { AppProvider } from './context/AppContext'
import { checkUserStatus, logout } from './services/auth'

// Компонент для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('userRole') !== null
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
                <AdminLayout>
                  <GlobalPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/charts"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ChartsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/voucher-confirmation"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <VoucherConfirmationPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-campaign"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EmailCampaignPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AppProvider>
  )
}

export default App
