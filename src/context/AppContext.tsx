import type { UserRole } from '../types/admin'
import type { ReactNode } from 'react'

import { useState } from 'react'

import { AppContext } from './appContextBase'

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [adminName, setAdminName] = useState<string>('')
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [menu, setMenu] = useState<boolean>(false)
  const [select, setSelect] = useState<string>('works')

  const adminValues = {
    adminName,
    setAdminName,
    userRole,
    setUserRole,
    select,
    setSelect,
    menu,
    setMenu,
  }

  return <AppContext.Provider value={adminValues}>{children}</AppContext.Provider>
}
