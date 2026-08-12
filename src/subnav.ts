// Реестр саб-навигации (вторая строка шапки) для модулей с URL-табами.
// Табы отсюда рендерит AdminHeader (полоса под главным меню), а страницы-layout'ы
// модулей (AnalyticsPage/TeamPage) берут отсюда подпись активного таба для заголовка.
// Новый таб = строка здесь + роут в App.tsx.

export interface SubTab {
  to: string
  label: string
}

export interface SubnavDef {
  basePath: string
  moduleLabel: string
  tabs: SubTab[]
}

export const SUBNAV: SubnavDef[] = [
  {
    basePath: '/global/analytics',
    moduleLabel: 'Аналитика',
    tabs: [
      { to: 'forecast', label: 'Прогноз' },
      { to: 'procedures', label: 'Статистика процедур' },
      { to: 'global-stats', label: 'Глобальная статистика' },
      { to: 'overview', label: 'Недельный обзор' },
      { to: 'charts', label: 'Недельные графики' },
      { to: 'clients', label: 'Новые vs повторные' },
      { to: 'sleeping', label: 'Спящие клиенты' },
      { to: 'comeback', label: 'Напоминания о визите' },
      { to: 'retention', label: 'Возвращаемость' },
      { to: 'cancellations', label: 'Отмены' },
      { to: 'vouchers', label: 'Ваучеры' },
    ],
  },
  {
    basePath: '/global/team',
    moduleLabel: 'Команда',
    tabs: [
      { to: 'salaries', label: 'Зарплаты' },
      { to: 'priority', label: 'Priorita masterů' },
      { to: 'time-off', label: 'Больничные / отпуска' },
      { to: 'taxes', label: 'Налоги' },
      { to: 'load', label: 'Загрузка' },
      { to: 'gaps', label: 'Окна' },
      { to: 'cross-sell', label: 'Дозапись в окно' },
    ],
  },
]

// Саб-навигация для текущего pathname (или undefined — модуль без табов)
export const subnavForPathname = (pathname: string): SubnavDef | undefined =>
  SUBNAV.find((s) => pathname === s.basePath || pathname.startsWith(`${s.basePath}/`))

// Подпись активного таба (точный матч сегмента; табы без вложенных путей)
export const activeTabLabel = (sub: SubnavDef, pathname: string): string =>
  sub.tabs.find((t) => pathname === `${sub.basePath}/${t.to}`)?.label ?? sub.moduleLabel
