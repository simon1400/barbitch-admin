// Линейные SVG-иконки главного меню шапки (lucide-стиль, currentColor) — пункты
// «Главная» и «Календарь» в пилюлях рисуются иконкой вместо подписи.
// Размер задаётся className (дефолт h-[17px] w-[17px]).

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

type IconProps = { className?: string }

export const IconHome = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
)

export const IconCalendar = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </svg>
)

// Аналитика — столбики графика
export const IconAnalytics = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <path d="M3 21h18" />
    <path d="M7 21v-7" />
    <path d="M12 21V6" />
    <path d="M17 21v-11" />
  </svg>
)

// Каталог услуг — список (пункты с маркерами)
export const IconCatalog = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <path d="M9 6h12" />
    <path d="M9 12h12" />
    <path d="M9 18h12" />
    <path d="M4 6h.01" />
    <path d="M4 12h.01" />
    <path d="M4 18h.01" />
  </svg>
)

// Команда — двое людей
export const IconTeam = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
    <path d="M16.5 5.6a3.2 3.2 0 0 1 0 5.9" />
    <path d="M18 14.4a5.5 5.5 0 0 1 2.5 4.6v1" />
  </svg>
)
