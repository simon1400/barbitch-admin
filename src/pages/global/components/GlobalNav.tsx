import { Link, useLocation } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
}

const navItems: NavItem[] = [
  { path: '/global', label: 'Главная' },
  { path: '/global/weekly-overview', label: 'Недельный обзор' },
  { path: '/global/salaries', label: 'Зарплаты' },
  { path: '/global/expenses', label: 'Затраты' },
  { path: '/global/procedures-stats', label: 'Статистика процедур' },
  { path: '/global/weekly-charts', label: 'Недельные графики' },
  { path: '/global/charts', label: 'Чарты глобальные' },
  { path: '/voucher-confirmation', label: 'Potvrzení voucheru' },
  { path: '/email-campaign', label: 'Email kampaň' },
  { path: '/global/noona-services', label: 'Процедуры Noona' },
  { path: '/global/noona-activity', label: 'История Noona' },
  { path: '/global/shift-close', label: 'Uzavření směny' },
  { path: '/global/blog-ai', label: 'Blog AI' },
  { path: '/global/reviews', label: 'Google Reviews' },
  { path: '/global/master-priority', label: 'Priorita masterů' },
]

export const GlobalNav = () => {
  const location = useLocation()

  return (
    <nav className="mt-4 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      <div className="grid grid-rows-3 grid-flow-col auto-cols-max gap-1.5 md:flex md:flex-wrap md:w-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              location.pathname === item.path
                ? 'bg-white text-primary'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
