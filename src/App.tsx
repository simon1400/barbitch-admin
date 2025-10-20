import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminPage from './pages/admin/AdminPage'
import GlobalPage from './pages/admin/global/GlobalPage'
import ChartsPage from './pages/admin/global/charts/ChartsPage'
import { AppProvider } from './context/AppContext'

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <AdminLayout>
                <AdminPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/global"
            element={
              <AdminLayout>
                <GlobalPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/global/charts"
            element={
              <AdminLayout>
                <ChartsPage />
              </AdminLayout>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  )
}

export default App
