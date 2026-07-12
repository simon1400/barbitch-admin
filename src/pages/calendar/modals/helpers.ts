// Общие хелперы/константы модалов календаря. Не-компонентные экспорты живут
// здесь (не в ui.tsx) — eslint react-refresh/only-export-components запрещает
// смешивать компоненты и константы в одном файле.

import type { CatalogService } from '../fetch/engineApi'
import { fmtHM } from '../utils'

export { fmtHM }

export const toMin = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

// Слоты времени брони: 10:00–19:00, шаг 30 мин
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let m = 10 * 60; m <= 19 * 60; m += 30) out.push(fmtHM(m))
  return out
})()

// Дни недели: value = getUTCDay (0=Ne..6=So), порядок Po..Ne
export const WEEKDAYS: { v: number; label: string }[] = [
  { v: 1, label: 'Po' },
  { v: 2, label: 'Út' },
  { v: 3, label: 'St' },
  { v: 4, label: 'Čt' },
  { v: 5, label: 'Pá' },
  { v: 6, label: 'So' },
  { v: 0, label: 'Ne' },
]

export const addDays = (d: string, n: number): string =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

export const weekdayOf = (d: string): number => new Date(`${d}T00:00:00Z`).getUTCDay()

export const blokPlural = (n: number): string =>
  n === 1 ? 'blok' : n >= 2 && n <= 4 ? 'bloky' : 'bloků'

export const inputCls = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm'
export const labelCls = 'mb-1 block text-xs font-semibold text-gray-500'

// Выбор в пикере услуги (ServicePicker) — общий для «Nová rezervace» и «Změnit službu»
export interface ServiceSelection {
  service: CatalogService | null
  variantLabel: string
  modKeys: string[]
}
export const EMPTY_SERVICE_SELECTION: ServiceSelection = { service: null, variantLabel: '', modKeys: [] }
