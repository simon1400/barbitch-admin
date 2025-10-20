import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import Button from './Button'

export const LogoutButton = () => {
  const { setAdminName } = useAppContext()
  const navigate = useNavigate()

  const logout = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault()
    localStorage.removeItem('usernameLocalData')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')
    setAdminName('')
    navigate('/login')
  }

  return (
    <div>
      <Button text={'Odhlasit se'} id={'logout-button'} href={'/'} onClick={logout} />
    </div>
  )
}
