// ЕДИНЫЙ реестр модулей админки и ролей, которым они доступны.
// Открыть/закрыть модуль для роли = поменять массив roles ЗДЕСЬ — больше нигде.
// Реестр питает: роуты (ModuleRoute в App.tsx), меню в шапке (AdminHeader — пилюли
// главного меню + дропдаун «Ещё») и внутристраничный гейт (OwnerProtection).
// «Главная» в меню не отсюда — она своя у каждой роли
// (owner/manager → /global, administrator → /administrator-cabinet, master → /).
// manager (управляющая, s213) = владелец везде, КРОМЕ email-рассылки.

import type { UserRole } from './types/admin'

export interface ModuleDef {
  path: string
  label: string
  // кто видит модуль (пункт меню + доступ по роуту)
  roles: UserRole[]
  // модуль с вложенными URL-табами (подсветка пункта и матч гейта по startsWith)
  hasTabs?: boolean
  // второстепенный модуль — в шапке уходит в дропдаун «Ещё» (если у роли модулей много)
  more?: boolean
  // вкладки модуля с hasTabs, закрытые части его ролей: сегмент URL → кто видит
  // (пункт саб-меню + внутристраничный гейт); вкладки вне списка — все roles модуля
  tabRoles?: Record<string, UserRole[]>
}

const MODULES: ModuleDef[] = [
  // дашборд «что требует внимания» (s214) — первая пилюля руководства; домашняя остаётся /global
  { path: '/today', label: 'Сегодня', roles: ['owner', 'manager'] },
  // ежедневный отчёт управляющей владельцу (s239) — на виду, не в «Ещё»; администраторам — нет
  { path: '/vykaz', label: 'Výkaz práce', roles: ['manager'] },
  // календарь: master попадает только по кнопке (read-only своя неделя), меню у него нет
  { path: '/calendar', label: 'Календарь', roles: ['owner', 'manager', 'administrator', 'master'] },
  { path: '/global/analytics', label: 'Аналитика', roles: ['owner', 'manager'], hasTabs: true },
  // «Výkazy» (s239) — отчёты управляющей читает только владелец; «Úkoly» (s240) — поручения
  // ей ставит только владелец (свои она видит в /vykaz)
  {
    path: '/global/team',
    label: 'Команда',
    roles: ['owner', 'manager'],
    hasTabs: true,
    tabRoles: { reports: ['owner'], tasks: ['owner'] },
  },
  // плановый график мастеров (s218): администратор видит и ПРЕДЛАГАЕТ изменения дня
  // (действуют после согласования руководства); мастер сам себе ничего не меняет
  { path: '/schedule', label: 'График мастеров', roles: ['owner', 'manager', 'administrator'] },
  { path: '/upsell', label: 'Дозаписи', roles: ['owner', 'manager', 'administrator'] },
  { path: '/global/catalog', label: 'Каталог услуг', roles: ['owner', 'manager', 'administrator'] },
  { path: '/global/shift-close', label: 'Uzavření směny', roles: ['owner', 'manager'] },
  { path: '/voucher-confirmation', label: 'Potvrzení voucheru', roles: ['owner', 'manager'] },
  { path: '/global/expenses', label: 'Затраты', roles: ['owner', 'manager'], more: true },
  { path: '/email-campaign', label: 'Email kampaň', roles: ['owner'], more: true },
  { path: '/global/loyalty', label: 'Лояльность', roles: ['owner', 'manager'], more: true },
  {
    path: '/global/client-duplicates',
    label: 'Дубли клиентов',
    roles: ['owner', 'manager', 'administrator'],
    more: true,
  },
  { path: '/global/reviews', label: 'Google Reviews', roles: ['owner', 'manager'], more: true },
  { path: '/global/error-logs', label: 'Error Logs', roles: ['owner', 'manager'], more: true },
  // «Мои данные» (фаза 2 карточки): своя карточка, только чтение; у владельца карточки нет
  { path: '/me', label: 'Мои данные', roles: ['manager', 'administrator', 'master'], more: true },
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
// Не найден в реестре → консервативный дефолт: только руководство (владелец + управляющая).
export const rolesForPathname = (pathname: string): UserRole[] => {
  const mod = MODULES.find(
    (m) => pathname === m.path || (m.hasTabs && pathname.startsWith(`${m.path}/`)),
  )
  if (!mod) return ['owner', 'manager']
  const tab = pathname.startsWith(`${mod.path}/`) ? pathname.slice(mod.path.length + 1).split('/')[0] : ''
  return mod.tabRoles?.[tab] ?? mod.roles
}

// Видит ли роль вкладку модуля (саб-меню шапки)
export const canSeeTab = (basePath: string, tab: string, role: string | null): boolean =>
  !!role && (rolesForPathname(`${basePath}/${tab}`) as string[]).includes(role)
