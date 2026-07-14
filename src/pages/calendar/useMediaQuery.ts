// Реактивные media-query хуки календаря: адаптивный масштаб грида (телефон)
// и детект тач-устройства (pointer: coarse) — там нет hover и HTML5 drag-and-drop.

import { useEffect, useState } from 'react'

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Телефон (< sm-брейкпоинт Tailwind): узкие колонки + крупнее вертикальный масштаб
export const useIsNarrow = () => useMediaQuery('(max-width: 639px)')

// Основной указатель — палец: drag-and-drop недоступен (перенос через «Změnit termín»)
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
