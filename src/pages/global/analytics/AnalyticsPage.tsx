import { Outlet, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import { OwnerProtection } from '../components/OwnerProtection'
import { SUBNAV, activeTabLabel } from '../../../subnav'

// Layout модуля «Аналитика». Табы рендерит шапка (AdminHeader → саб-меню,
// реестр src/subnav.ts) — здесь только крошка + заголовок активного таба + Outlet.
const sub = SUBNAV.find((s) => s.basePath === '/global/analytics')!

export default function AnalyticsPage() {
  const location = useLocation()

  return (
    <OwnerProtection>
      <section className="min-h-screen">
        <div className="max-w-[1024px] mx-auto px-5 pt-7 pb-[60px]">
          <div className="text-[11px] font-bold tracking-[.08em] uppercase text-ink-faint mb-1">
            {sub.moduleLabel}
          </div>
          <h1 className="mb-5 text-[24px] leading-[1.2] font-extrabold text-ink">
            {activeTabLabel(sub, location.pathname)}
          </h1>

          <Suspense
            fallback={<div className="py-12 text-center text-sm text-gray-400">Načítání…</div>}
          >
            <Outlet />
          </Suspense>
        </div>
      </section>
    </OwnerProtection>
  )
}
