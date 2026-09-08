import { useAppContext } from '../../../context/AppContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { rolesForPathname } from '../../../moduleAccess'
import { getSessionRole } from '../../../services/auth'

// Внутристраничный гейт доступа. Разрешённые роли берутся из ЕДИНОГО реестра
// src/moduleAccess.ts по текущему pathname; страница вне реестра = только владелец.
// Открыть модуль другой роли = поправить roles в реестре (этот компонент не трогать).
export const OwnerProtection = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useAppContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Роль берём из ПОДПИСАННОГО токена сессии, а не из localStorage-ключа:
    // ключ пользователь может переписать сам (s181, п. 1.5).
    const sessionRole = getSessionRole()
    const allowedRoles = rolesForPathname(location.pathname)
    const allowed = !!sessionRole && (allowedRoles as string[]).includes(sessionRole)

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
