import { useEffect, useState } from 'react'

interface NavItem {
  id: string
  label: string
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'reservations', label: 'Резервации' },
  { id: 'charts', label: 'Графики' },
  { id: 'masters', label: 'Мастера' },
  { id: 'admins', label: 'Админы' },
  { id: 'calculations', label: 'Расчёты' },
]

export const QuickNav = () => {
  const [activeSection, setActiveSection] = useState('overview')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200)

      // Определяем активную секцию
      const sections = navItems.map((item) => document.getElementById(item.id))
      const scrollPosition = window.scrollY + 150

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navItems[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80
      const elementPosition = element.offsetTop - offset
      window.scrollTo({ top: elementPosition, behavior: 'smooth' })
    }
  }

  if (!isVisible) return null

  return (
    <nav className={'fixed top-20 right-4 z-50 hidden lg:block'}>
      <div className={'bg-white shadow-xl rounded-lg p-3 border border-gray-200'}>
        <div className={'flex flex-col gap-2'}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type={'button'}
              onClick={() => scrollToSection(item.id)}
              className={`text-sm px-3 py-2 rounded-md transition-all text-left whitespace-nowrap ${
                activeSection === item.id
                  ? 'bg-primary text-white font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
