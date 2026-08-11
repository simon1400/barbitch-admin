import { useAppContext } from '../../../context/AppContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { rolesForPathname } from '../../../moduleAccess'

// Внутристраничный гейт доступа. Разрешённые роли берутся из ЕДИНОГО реестра
// src/moduleAccess.ts по текущему pathname; страница вне реестра = только владелец.
// Открыть модуль другой роли = поправить roles в реестре (этот компонент не трогать).
export const OwnerProtection = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useAppContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Проверяем роль из localStorage против реестра модулей
    const storedRole = localStorage.getItem('userRole')
    const allowedRoles = rolesForPathname(location.pathname)
    const allowed = !!storedRole && (allowedRoles as string[]).includes(storedRole)

    if (!allowed) {
      navigate('/')
    } else {
      setIsChecking(false)
    }
  }, [userRole, navigate, location.pathname])

  if (isChecking) {
    return (
      <div className={'fixed inset-0 flex items-center justify-center bg-white'}>
        <div className={'text-center'}>
          <div
            className={'inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary'}
          />
          <p className={'mt-4 text-gray-600'}>Проверка доступа...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
