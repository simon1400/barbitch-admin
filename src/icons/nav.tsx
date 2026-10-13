// Линейные SVG-иконки главного меню шапки (lucide-стиль, currentColor) — пункты
// «Главная» и «Календарь» в пилюлях рисуются иконкой вместо подписи.
// Размер задаётся className (дефолт h-[17px] w-[17px]; в шапке с s254 — 21px).
// s254: + «Сегодня» (солнце), «Výkaz práce» (планшет с листом), «Sklad» (коробка),
// «Uzavření směny» (чек).

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

// Сегодня — солнце
export const IconToday = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.93 4.93l1.41 1.41" />
    <path d="M17.66 17.66l1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M6.34 17.66l-1.41 1.41" />
    <path d="M19.07 4.93l-1.41 1.41" />
  </svg>
)

// Výkaz práce — планшет с листом отчёта
export const IconReport = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" />
    <path d="M9 16h4" />
  </svg>
)

// Sklad — коробка
export const IconStock = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
    <path d="M7.5 5.5l9 5" />
  </svg>
)

// Uzavření směny — чек (итог дня)
export const IconShiftClose = ({ className = 'h-[17px] w-[17px]' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...svgProps}>
    <path d="M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h3" />
  </svg>
)
