import { Link, useLocation } from 'react-router-dom'
import type { UserRole } from '../../../types/admin'
import { modulesForRole } from '../../../moduleAccess'

// Меню модулей в шапке. Показывается owner И administrator (у мастера меню нет).
// Список пунктов = ЕДИНЫЙ реестр src/moduleAccess.ts, отфильтрованный по роли;
// «Главная» у каждой роли своя (owner → /global, administrator → /administrator-cabinet).
export const GlobalNav = () => {
  const location = useLocation()
  const role = localStorage.getItem('userRole') as UserRole | null

  if (role !== 'owner' && role !== 'administrator') return null

  const home = role === 'owner' ? '/global' : '/administrator-cabinet'
  const modules = modulesForRole(role)
  const items = [{ path: home, label: 'Главная', hasTabs: false }, ...modules]

  // Модули с вложенными URL-табами подсвечиваются по startsWith (например /global/analytics/overview)
  const isActive = (path: string, hasTabs?: boolean) =>
    hasTabs ? location.pathname.startsWith(path) : location.pathname === path

  return (
    <nav className="mt-4 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      <div
        className={`${items.length > 6 ? 'grid grid-rows-3 grid-flow-col auto-cols-max' : 'flex flex-wrap'} gap-1.5 md:flex md:flex-wrap md:w-auto`}
      >
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              isActive(item.path, item.hasTabs)
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
