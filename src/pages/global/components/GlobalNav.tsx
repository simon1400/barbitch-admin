import { Link, useLocation } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
}

const navItems: NavItem[] = [
  { path: '/global', label: 'Главная' },
  { path: '/global/analytics', label: 'Аналитика' },
  { path: '/global/team', label: 'Команда' },
  { path: '/global/expenses', label: 'Затраты' },
  { path: '/voucher-confirmation', label: 'Potvrzení voucheru' },
  { path: '/email-campaign', label: 'Email kampaň' },
  { path: '/global/noona', label: 'Noona' },
  { path: '/global/shift-close', label: 'Uzavření směny' },
  { path: '/global/blog-ai', label: 'Blog AI' },
  { path: '/global/reviews', label: 'Google Reviews' },
  { path: '/global/error-logs', label: 'Error Logs' },
]

export const GlobalNav = () => {
  const location = useLocation()

  // Parent routes with sub-route tabs — highlight on any matching /path/* (e.g. /global/noona/services)
  const parentRoutes = ['/global/noona', '/global/analytics', '/global/team']
  const isActive = (path: string) =>
    parentRoutes.includes(path)
      ? location.pathname.startsWith(path)
      : location.pathname === path

  return (
    <nav className="mt-4 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      <div className="grid grid-rows-3 grid-flow-col auto-cols-max gap-1.5 md:flex md:flex-wrap md:w-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              isActive(item.path)
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
