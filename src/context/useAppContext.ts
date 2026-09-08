// Хук доступа к AppContext. Отдельный модуль — см. комментарий в appContextBase.ts.
import { useContext } from 'react'

import { AppContext } from './appContextBase'

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
