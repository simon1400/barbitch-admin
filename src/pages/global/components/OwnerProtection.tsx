import { useAppContext } from '../../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

interface OwnerProtectionProps {
  children: React.ReactNode
  // Пустить и администраторов (по умолчанию — только владелец)
  allowAdministrator?: boolean
}

export const OwnerProtection = ({ children, allowAdministrator = false }: OwnerProtectionProps) => {
  const { userRole } = useAppContext()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Проверяем роль из localStorage
    const storedRole = localStorage.getItem('userRole')
    const allowed = storedRole === 'owner' || (allowAdministrator && storedRole === 'administrator')

    if (!allowed) {
      navigate('/')
    } else {
      setIsChecking(false)
    }
  }, [userRole, navigate, allowAdministrator])

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
