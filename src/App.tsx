import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminLayout from './pages/dashboard/AdminLayout'
import AdminPage from './pages/dashboard/AdminPage'
import GlobalPage from './pages/global/GlobalPage'
import ChartsPage from './pages/global/charts/ChartsPage'
import VoucherConfirmationPage from './pages/voucher-confirmation/VoucherConfirmationPage'
import { AppProvider } from './context/AppContext'

// Компонент для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('userRole') !== null
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
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
            path="/voucher"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <VoucherConfirmationPage />
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
