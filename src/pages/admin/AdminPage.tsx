import { useAppContext } from '../../context/AppContext'

import OptimizedWorks from './components/OptimizedWorks'

const AdminPage = () => {
  const { select } = useAppContext()
  if (select === 'works') {
    return <OptimizedWorks />
  }
  return null
}

export default AdminPage
