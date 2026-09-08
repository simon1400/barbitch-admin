import type { UserRole } from '../../types/admin'

import { Container } from '../../components/Container'
import { useAppContext } from '../../context/AppContext'
import { useOnMountUnsafe } from '../../hooks/useOnMountUnsafe'
import { useNavigate } from 'react-router-dom'
import { AdminHeader } from '../../components/AdminHeader'
import { getSession } from '../../services/auth'

import './styles.css'

export default function AdminLayout({
  children,
  bare = false,
}: Readonly<{
  children: React.ReactNode
  // bare: без розового хедера и Container — страница сама управляет своей шириной (календарь)
  bare?: boolean
}>) {
  const { adminName, setAdminName } = useAppContext()
  const { setUserRole } = useAppContext()
  const navigate = useNavigate()

  const getAuthUser = () => {
    // имя и роль — из токена сессии (localStorage-ключи подменяемы)
    const session = getSession()
    const storedUsername = session?.username
    const storedRole = (session?.role ?? null) as UserRole | null

    if (!storedUsername || !storedRole) {
      setAdminName('')
      setUserRole(null)
      navigate('/login')
      return
    }

    setAdminName(storedUsername)
    setUserRole(storedRole)
  }

  useOnMountUnsafe(() => {
    getAuthUser()
  })

  if (bare) {
    return (
      <div id={'layout-admin-page'}>
        <main className={'w-full'}>{children}</main>
      </div>
    )
  }

  return (
    <div id={'layout-admin-page'}>
      <AdminHeader userName={adminName} />
      <Container size={'xl'}>
        <div className={'md:flex'}>
          <main className={'w-full'}>{children}</main>
        </div>
      </Container>
    </div>
  )
}
