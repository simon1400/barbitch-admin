import { NavLink, Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { Container } from '../../../components/Container'
import { OwnerProtection } from '../components/OwnerProtection'

interface NoonaTab {
  to: string
  label: string
}

// Под-вкладки модуля Noona. Добавляй сюда новые инструменты работы с Noona —
// достаточно дописать таб + роут в App.tsx.
const tabs: NoonaTab[] = [
  { to: 'services', label: 'Pridat +' },
  { to: 'manage', label: 'Správa služeb' },
  { to: 'masters', label: 'Mistři' },
  { to: 'price-increase', label: 'Změna cen' },
  { to: 'history', label: 'Historie' },
  { to: 'junior', label: 'Junior služby' },
]

export default function NoonaPage() {
  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="pt-8">
            <nav className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-4">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400'
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>

            <Suspense
              fallback={<div className="py-12 text-center text-sm text-gray-400">Načítání…</div>}
            >
              <Outlet />
            </Suspense>
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}
