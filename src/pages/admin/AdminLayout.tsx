import type { UserRole } from '../../types/admin'

import { Container } from '../../components/Container'
import { useAppContext } from '../../context/AppContext'
import { useOnMountUnsafe } from '../../hooks/useOnMountUnsafe'
import { useNavigate } from 'react-router-dom'
import { Top } from '../../components/Top'

import './styles.scss'

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { adminName, setAdminName } = useAppContext()
  const { setUserRole } = useAppContext()
  const navigate = useNavigate()

  const getAuthUser = () => {
    const storedUsername = localStorage.getItem('usernameLocalData')
    const storedRole = localStorage.getItem('userRole') as UserRole | null

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

  return (
    <div id={'layout-admin-page'}>
      <Top title={adminName} small linkToReserve={''} admin />
      <Container size={'xl'}>
        <div className={'md:flex'}>
          <main className={'w-full'}>{children}</main>
        </div>
      </Container>
    </div>
  )
}
