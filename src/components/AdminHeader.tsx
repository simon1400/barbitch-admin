import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { UserRole } from '../types/admin'
import { canSeeTab, modulesForRole, type ModuleDef } from '../moduleAccess'
import { subnavForPathname } from '../subnav'
import { getSessionRole, logout } from '../services/auth'
import { LogoIcon } from '../icons/Logo'
import {
  IconAnalytics,
  IconCalendar,
  IconCatalog,
  IconHome,
  IconReport,
  IconSmena,
  IconShiftClose,
  IconStock,
  IconTeam,
  IconToday,
} from '../icons/nav'
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
  manager: '/global',
  administrator: '/administrator-cabinet',
  master: '/',
}

// Пункты меню, которые рисуются иконкой вместо подписи (подпись — в aria-label и во
// всплывающей подсказке при наведении/фокусе). «Главная» — по её роль-зависимому пути,
// см. HOME_BY_ROLE. s254: + «Сегодня», «Výkaz práce», «Sklad», «Uzavření směny»; меню крупнее
// (15px, иконки 21px), подсказка своя (родной `title` появляется через ~1 с — его убрали).
type IconComp = ({ className }: { className?: string }) => React.ReactElement

const NAV_ICONS: Partial<Record<string, IconComp>> = {
  '/calendar': IconCalendar,
  '/global/analytics': IconAnalytics,
  '/global/team': IconTeam,
  '/global/catalog': IconCatalog,
  '/today': IconToday,
  '/vykaz': IconReport,
  '/smena': IconSmena,
  '/stock': IconStock,
  '/global/shift-close': IconShiftClose,
}

const pillCls = (on: boolean, iconOnly = false) =>
  `${iconOnly ? 'px-3.5 inline-flex items-center' : 'px-4'} py-2.5 rounded-full text-[15px] font-bold whitespace-nowrap transition-all duration-150 ${
    on
      ? 'bg-brand text-white shadow-brand-pill'
      : 'text-ink-muted hover:text-ink'
  }`

// s256: шапка прячется при скролле вниз и возвращается при скролле вверх (на телефоне
// sticky-шапка с саб-меню съедала пол-экрана). У верха страницы видна всегда.
const SHOW_ZONE_PX = 120
const SCROLL_DELTA_PX = 6

const useHideOnScroll = (disabled: boolean) => {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (disabled) {
      setHidden(false)
      return
    }
    let lastY = window.scrollY
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const dy = y - lastY
        if (y < SHOW_ZONE_PX) {
          setHidden(false)
          lastY = y
        } else if (Math.abs(dy) > SCROLL_DELTA_PX) {
          setHidden(dy > 0)
          lastY = y
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [disabled])

  return [hidden, setHidden] as const
}

export const AdminHeader = ({ userName }: { userName: string }) => {
  const location = useLocation()
  const role = getSessionRole()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  // мобильное меню (< md): выезжающая панель вместо пилюль
  const [drawerOpen, setDrawerOpen] = useState(false)
  const subRef = useRef<HTMLElement>(null)
  const [hidden, setHidden] = useHideOnScroll(moreOpen || drawerOpen)

  // навигация закрывает дропдаун/панель и показывает шапку
  useEffect(() => {
    setMoreOpen(false)
    setDrawerOpen(false)
    setHidden(false)
  }, [location.pathname, setHidden])

  // панель: Esc закрывает, страница под ней не скроллится
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  // саб-меню — одна прокручиваемая строка: активный таб докручиваем в видимую зону
  // (scrollLeft, а не scrollIntoView — тот дёргает и вертикальный скролл страницы)
  useEffect(() => {
    const el = subRef.current
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!el || !active) return
    el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
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
  const inline = splitToMore ? items.filter((m) => !m.more) : items
  // s255 (просьба владельца): сначала все иконки, потом текстовые пункты — порядок внутри
  // каждой группы как в реестре
  const hasIcon = (m: NavItem) => m.path === home || Boolean(NAV_ICONS[m.path])
  const primary = [...inline.filter(hasIcon), ...inline.filter((m) => !hasIcon(m))]
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
    <>
    <div
      className={`sticky top-0 z-40 transition-transform duration-200 ease-out will-change-transform ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
      onFocusCapture={() => setHidden(false)}
    >
      <div className={'h-[3px] bg-gradient-to-r from-brand to-brand-grad-to'} />

      {/* relative z-10: backdrop-blur делает header и саб-меню отдельными слоями —
          без z-index саб-меню (ниже по DOM) перекрывает дропдаун «Ещё» */}
      <header
        className={
          'relative z-10 bg-[rgba(255,255,255,.96)] backdrop-blur-md border-b border-line-header'
        }
      >
        <div className={'max-w-[1024px] mx-auto px-2 md:px-5'}>
          {/* Ряд 1: лого + юзер */}
          <div className={'flex items-center justify-between gap-4 py-1.5 md:pt-3.5 md:pb-2.5'}>
            <Link to={home} aria-label={'Перейти на главную'} className={'flex-none'}>
              <LogoIcon className={'h-[17px] w-auto fill-ink'} dotFill={CHART.brand} />
            </Link>

            <div className={'flex items-center gap-3.5 min-w-0'}>
              <div className={'hidden md:flex items-center gap-2.5 min-w-0'}>
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
                  'hidden md:inline-flex px-3.5 py-2 rounded-lg border border-line-btn hover:border-line-btn-hover bg-white text-ink-body text-[12.5px] font-bold whitespace-nowrap transition-colors'
                }
              >
                {'Odhlásit se'}
              </button>

              {role && (
                <button
                  type={'button'}
                  onClick={() => setDrawerOpen(true)}
                  aria-label={'Открыть меню'}
                  aria-expanded={drawerOpen}
                  aria-controls={'admin-mobile-menu'}
                  className={
                    'md:hidden inline-flex items-center justify-center w-[44px] h-[44px] -mr-1 rounded-full text-ink hover:bg-surface-hover transition-colors'
                  }
                >
                  <svg viewBox={'0 0 24 24'} className={'h-[24px] w-[24px]'} fill={'none'} stroke={'currentColor'} strokeWidth={2} strokeLinecap={'round'} aria-hidden>
                    <path d={'M4 7h16M4 12h16M4 17h16'} />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Ряд 2: главное меню */}
          {role && (
            <nav className={'hidden md:flex items-center gap-1 flex-wrap pb-2.5'}>
              {primary.map((item) => {
                const Icon = item.path === home ? IconHome : NAV_ICONS[item.path]
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-label={Icon ? item.label : undefined}
                    className={`${pillCls(isActive(item), Boolean(Icon))} ${Icon ? 'relative group' : ''}`}
                    data-nav={item.path}
                  >
                    {Icon ? (
                      <>
                        {/* высота = line-box подписи соседних пилюль (15px × 1.5) —
                            чтобы иконочная пилюля не была ниже текстовых */}
                        <span className={'flex items-center h-[22px]'}>
                          <Icon className={'h-[21px] w-[21px]'} />
                        </span>
                        <span
                          role={'tooltip'}
                          className={
                            'pointer-events-none absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 z-50 rounded-md bg-ink px-2.5 py-1.5 text-[13px] font-bold text-white whitespace-nowrap shadow-pop opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100'
                          }
                        >
                          {item.label}
                        </span>
                      </>
                    ) : (
                      item.label
                    )}
                  </Link>
                )
              })}

              {moreItems.length > 0 && (
                <div className={'relative'} ref={moreRef}>
                  <button
                    type={'button'}
                    onClick={() => setMoreOpen((v) => !v)}
                    className={pillCls(moreOpen || moreActive)}
                  >
                    {'Ещё '}
                    <span className={'text-[11px]'}>{'▾'}</span>
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
                          className={`block w-full text-left px-3.5 py-2.5 rounded-[7px] text-[15px] font-bold transition-colors ${
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
          {/* одна строка с горизонтальным скроллом вместо переноса в 3–4 ряда;
              края гаснут маской — видно, что строка прокручивается */}
          <nav
            ref={subRef}
            aria-label={sub.moduleLabel}
            className={
              'max-w-[1024px] mx-auto px-2 md:px-5 flex flex-nowrap gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-28px),transparent)]'
            }
          >
            {sub.tabs.filter((t) => canSeeTab(sub.basePath, t.to, role)).map((t) => (
              <NavLink
                key={t.to}
                to={`${sub.basePath}/${t.to}`}
                className={({ isActive: on }) =>
                  `flex-none px-3 py-2.5 md:py-3 text-[14px] font-bold whitespace-nowrap transition-colors duration-150 ${
                    on
                      ? 'text-brand-dark shadow-[inset_0_-2px_0_theme(colors.brand)]'
                      : 'text-ink-soft hover:text-ink-body'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
            {/* хвост под маску правого края */}
            <span className={'flex-none w-4'} aria-hidden />
          </nav>
        </div>
      )}
    </div>

    {/* Мобильное меню (< md). Вне sticky-обёртки: её transform/backdrop-blur стали бы
        containing block для fixed и панель сжалась бы до высоты шапки. */}
    {role && (
      <div
        id={'admin-mobile-menu'}
        className={`md:hidden fixed inset-0 z-[60] ${drawerOpen ? '' : 'pointer-events-none'}`}
        inert={!drawerOpen}
        aria-hidden={!drawerOpen}
      >
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          role={'dialog'}
          aria-modal={'true'}
          aria-label={'Меню'}
          className={`absolute right-0 top-0 h-[100dvh] w-[min(86vw,340px)] bg-white shadow-pop flex flex-col transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className={'flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-line-header'}>
            <div className={'flex items-center gap-2.5 min-w-0'}>
              <span
                className={
                  'w-[38px] h-[38px] rounded-full bg-gradient-to-br from-brand to-brand-grad-to text-white text-[15px] font-extrabold inline-flex items-center justify-center flex-none'
                }
              >
                {initial}
              </span>
              <span className={'flex flex-col leading-[1.15] min-w-0'}>
                <span className={'text-[15px] font-extrabold text-ink truncate'}>{userName}</span>
                <span className={'text-[11px] font-bold tracking-[.06em] uppercase text-ink-faint'}>
                  {role}
                </span>
              </span>
            </div>
            <button
              type={'button'}
              onClick={() => setDrawerOpen(false)}
              aria-label={'Закрыть меню'}
              className={'inline-flex items-center justify-center w-[44px] h-[44px] -mr-2 rounded-full text-ink-muted hover:bg-surface-hover'}
            >
              <svg viewBox={'0 0 24 24'} className={'h-[22px] w-[22px]'} fill={'none'} stroke={'currentColor'} strokeWidth={2} strokeLinecap={'round'} aria-hidden>
                <path d={'M6 6l12 12M18 6L6 18'} />
              </svg>
            </button>
          </div>

          <nav className={'flex-1 overflow-y-auto overscroll-contain p-2'}>
            {[...primary, ...moreItems].map((item, i) => {
              const Icon = item.path === home ? IconHome : NAV_ICONS[item.path]
              const on = isActive(item)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-3 min-h-[48px] px-3 rounded-[10px] text-[16px] font-bold transition-colors ${
                    i === primary.length && i > 0 ? 'mt-2 border-t border-line-header rounded-t-none pt-2' : ''
                  } ${on ? 'bg-brand-tint text-brand-dark' : 'text-ink-body hover:bg-surface-hover'}`}
                >
                  <span className={'w-[22px] flex-none inline-flex justify-center'}>
                    {Icon && <Icon className={'h-[21px] w-[21px]'} />}
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className={'p-4 border-t border-line-header pb-[max(16px,env(safe-area-inset-bottom))]'}>
            <button
              type={'button'}
              onClick={doLogout}
              className={
                'w-full min-h-[44px] rounded-lg border border-line-btn hover:border-line-btn-hover bg-white text-ink-body text-[14px] font-bold transition-colors'
              }
            >
              {'Odhlásit se'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
