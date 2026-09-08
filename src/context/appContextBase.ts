// Объект контекста и его тип. Вынесены из AppContext.tsx, потому что файл с
// компонентом обязан экспортировать только компоненты (react-refresh).
import { createContext } from 'react'

import type { UserRole } from '../types/admin'

export interface AppContextType {
  adminName: string
  setAdminName: (value: string) => void
  userRole: UserRole | null
  setUserRole: (value: UserRole | null) => void
  select: string
  setSelect: (value: string) => void
  menu: boolean
  setMenu: (value: boolean) => void
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
