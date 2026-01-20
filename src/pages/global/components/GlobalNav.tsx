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
]

export const GlobalNav = () => {
  const location = useLocation()

  return (
    <nav className="mt-6">
      <div className="flex flex-wrap gap-3">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
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
