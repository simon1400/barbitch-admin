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

export const inputCls =
  'w-full min-h-11 rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:min-h-0 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-100 dark:[color-scheme:dark] dark:placeholder:text-gray-500'
export const labelCls = 'mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400'

// Кнопки футера модалов: на тач-экране ≥44px высоты, на десктопе компактные
export const btnPrimaryCls =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40 sm:min-h-[38px]'
export const btnSecondaryCls =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 sm:min-h-[38px] dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]'

// Выбор в пикере услуги (ServicePicker) — общий для «Nová rezervace» и «Změnit službu»
export interface ServiceSelection {
  service: CatalogService | null
  variantLabel: string
  modKeys: string[]
}
export const EMPTY_SERVICE_SELECTION: ServiceSelection = { service: null, variantLabel: '', modKeys: [] }
