// Мелкие иконки экрана «Дозаписи» (stroke-SVG, цвет — currentColor).
interface IconProps {
  size?: number
  className?: string
}

const base = (size: number, className: string | undefined) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
})

/** Стрелка режима: `dir="after"` → вправо (hned po), `dir="before"` → влево (před). */
export function ModeArrow({ dir, size = 11 }: { dir: 'after' | 'before'; size?: number }) {
  return (
    <svg {...base(size, undefined)} strokeWidth={3}>
      {dir === 'after' ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M19 12H5M11 6l-6 6 6 6" />}
    </svg>
  )
}

export function ChevronLeft({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={2.2}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

export function ChevronRight({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={2.2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function ChevronDown({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={2.6}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function RefreshIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={2.2}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={2.6}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
