import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { UserRole } from '../types/admin'
import { modulesForRole, type ModuleDef } from '../moduleAccess'
import { subnavForPathname } from '../subnav'
import { logout } from '../services/auth'
import { LogoIcon } from '../icons/Logo'
import { CHART } from '../ui/chartColors'

// Новая шапка админки (редизайн s164 по standalone-макету «Шапка и меню»):
// розовая полоска 3px → белый бар (лого · юзер-чип · Odhlásit se) → главное меню
// пилюлями (второстепенные модули в дропдауне «Ещё») → саб-меню табовых модулей
// (реестр src/subnav.ts) полосой с underline-табами. Sticky на всех страницах.
// Список модулей = ЕДИНЫЙ реестр src/moduleAccess.ts, отфильтрованный по роли.

interface NavItem {
  path: string
  label: string
  hasTabs?: boolean
  more?: boolean
}

// «Главная» у каждой роли своя
const HOME_BY_ROLE: Record<UserRole, string> = {
  owner: '/global',
  administrator: '/administrator-cabinet',
  master: '/',
}

const pillCls = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-150 ${
    on
      ? 'bg-brand text-white shadow-brand-pill'
      : 'text-ink-muted hover:text-ink'
  }`

export const AdminHeader = ({ userName }: { userName: string }) => {
  const location = useLocation()
  const role = localStorage.getItem('userRole') as UserRole | null
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // навигация закрывает дропдаун
  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  // клик мимо — закрыть
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [moreOpen])

  const home = role ? HOME_BY_ROLE[role] : '/'
  const modules: ModuleDef[] = modulesForRole(role)
  const items: NavItem[] = [{ path: home, label: 'Главная' }, ...modules]

  // мало пунктов (administrator/master) → всё инлайн без «Ещё»
  const splitToMore = items.length > 8
  const primary = splitToMore ? items.filter((m) => !m.more) : items
  const moreItems = splitToMore ? items.filter((m) => m.more) : []

  const isActive = (item: NavItem) =>
    item.hasTabs ? location.pathname.startsWith(item.path) : location.pathname === item.path
  const moreActive = moreItems.some(isActive)

  const sub = subnavForPathname(location.pathname)
  const initial = (userName || '?').trim().charAt(0).toUpperCase()

  const doLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    logout()
  }

  return (
    <div className={'sticky top-0 z-40'}>
      <div className={'h-[3px] bg-gradient-to-r from-brand to-brand-grad-to'} />

      <header className={'bg-[rgba(255,255,255,.96)] backdrop-blur-md border-b border-line-header'}>
        <div className={'max-w-[1024px] mx-auto px-5'}>
          {/* Ряд 1: лого + юзер */}
          <div className={'flex items-center justify-between gap-4 pt-3.5 pb-2.5'}>
            <Link to={home} aria-label={'Перейти на главную'} className={'flex-none'}>
              <LogoIcon className={'h-[17px] w-auto fill-ink'} dotFill={CHART.brand} />
            </Link>

            <div className={'flex items-center gap-3.5 min-w-0'}>
              <div className={'flex items-center gap-2.5 min-w-0'}>
                <span
                  className={
                    'w-[34px] h-[34px] rounded-full bg-gradient-to-br from-brand to-brand-grad-to text-white text-[14px] font-extrabold inline-flex items-center justify-center flex-none'
                  }
                >
                  {initial}
                </span>
                <span className={'flex flex-col leading-[1.15] min-w-0'}>
                  <span className={'text-[13.5px] font-extrabold text-ink truncate'}>
                    {userName}
                  </span>
                  {role && (
                    <span
                      className={
                        'text-[10.5px] font-bold tracking-[.06em] uppercase text-ink-faint'
                      }
                    >
                      {role}
                    </span>
                  )}
                </span>
              </div>

              <button
                type={'button'}
                onClick={doLogout}
                className={
                  'px-3.5 py-2 rounded-lg border border-line-btn hover:border-line-btn-hover bg-white text-ink-body text-[12.5px] font-bold whitespace-nowrap transition-colors'
                }
              >
                {'Odhlásit se'}
              </button>
            </div>
          </div>

          {/* Ряд 2: главное меню */}
          {role && (
            <nav className={'flex items-center gap-1 flex-wrap pb-2.5'}>
              {primary.map((item) => (
                <Link key={item.path} to={item.path} className={pillCls(isActive(item))}>
                  {item.label}
                </Link>
              ))}

              {moreItems.length > 0 && (
                <div className={'relative'} ref={moreRef}>
                  <button
                    type={'button'}
                    onClick={() => setMoreOpen((v) => !v)}
                    className={pillCls(moreOpen || moreActive)}
                  >
                    {'Ещё '}
                    <span className={'text-[9px]'}>{'▾'}</span>
                  </button>

                  {moreOpen && (
                    <div
                      className={
                        'absolute top-[calc(100%+8px)] right-0 z-50 min-w-[220px] bg-white border border-line rounded-[10px] shadow-pop p-1.5'
                      }
                    >
                      {moreItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMoreOpen(false)}
                          className={`block w-full text-left px-3 py-[9px] rounded-[7px] text-[13px] font-bold transition-colors ${
                            isActive(item)
                              ? 'bg-brand-tint text-brand-dark'
                              : 'text-ink-body hover:bg-surface-hover'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Саб-меню табового модуля */}
      {sub && (
        <div
          className={'bg-[rgba(251,250,249,.97)] backdrop-blur-md border-b border-line-header'}
        >
          <div className={'max-w-[1024px] mx-auto px-5 flex gap-0.5 flex-wrap'}>
            {sub.tabs.map((t) => (
              <NavLink
                key={t.to}
                to={`${sub.basePath}/${t.to}`}
                className={({ isActive: on }) =>
                  `px-2.5 py-[11px] text-[12.5px] font-bold whitespace-nowrap transition-colors duration-150 ${
                    on
                      ? 'text-brand-dark shadow-[inset_0_-2px_0_theme(colors.brand)]'
                      : 'text-ink-soft hover:text-ink-body'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
