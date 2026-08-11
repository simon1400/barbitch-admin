// ЕДИНЫЙ реестр модулей админки и ролей, которым они доступны.
// Открыть/закрыть модуль для роли = поменять массив roles ЗДЕСЬ — больше нигде.
// Реестр питает: роуты (ModuleRoute в App.tsx), меню в шапке (GlobalNav — owner И
// administrator видят его как пилюли под заголовком) и внутристраничный гейт
// (OwnerProtection). «Главная» в меню не отсюда — она своя у каждой роли
// (owner → /global, administrator → /administrator-cabinet).

import type { UserRole } from './types/admin'

export interface ModuleDef {
  path: string
  label: string
  // кто видит модуль (пункт меню + доступ по роуту)
  roles: UserRole[]
  // модуль с вложенными URL-табами (подсветка пункта и матч гейта по startsWith)
  hasTabs?: boolean
}

export const MODULES: ModuleDef[] = [
  // календарь: master попадает только по кнопке (read-only своя неделя), меню у него нет
  { path: '/calendar', label: 'Календарь', roles: ['owner', 'administrator', 'master'] },
  { path: '/global/analytics', label: 'Аналитика', roles: ['owner'], hasTabs: true },
  { path: '/global/team', label: 'Команда', roles: ['owner'], hasTabs: true },
  { path: '/global/expenses', label: 'Затраты', roles: ['owner'] },
  { path: '/voucher-confirmation', label: 'Potvrzení voucheru', roles: ['owner'] },
  { path: '/email-campaign', label: 'Email kampaň', roles: ['owner'] },
  { path: '/global/catalog', label: 'Каталог услуг', roles: ['owner', 'administrator'] },
  { path: '/global/shift-close', label: 'Uzavření směny', roles: ['owner'] },
  { path: '/global/loyalty', label: 'Лояльность', roles: ['owner'] },
  { path: '/global/client-duplicates', label: 'Дубли клиентов', roles: ['owner', 'administrator'] },
  { path: '/global/blog-ai', label: 'Blog AI', roles: ['owner'] },
  { path: '/global/reviews', label: 'Google Reviews', roles: ['owner'] },
  { path: '/global/error-logs', label: 'Error Logs', roles: ['owner'] },
]

// Модули, доступные роли (порядок = порядок в меню)
export const modulesForRole = (role: UserRole | null): ModuleDef[] =>
  role ? MODULES.filter((m) => m.roles.includes(role)) : []

// Доступ роли к модулю по его каноническому path
export const canAccessModule = (path: string, role: string | null): boolean => {
  const mod = MODULES.find((m) => m.path === path)
  return !!mod && !!role && mod.roles.includes(role as UserRole)
}

// Роли, которым разрешён текущий pathname (для внутристраничного гейта).
// Не найден в реестре → консервативный дефолт: только владелец.
export const rolesForPathname = (pathname: string): UserRole[] => {
  const mod = MODULES.find(
    (m) => pathname === m.path || (m.hasTabs && pathname.startsWith(`${m.path}/`)),
  )
  return mod ? mod.roles : ['owner']
}
