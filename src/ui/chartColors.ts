// Цвета для мест, где hex нельзя задать классом Tailwind: пропсы recharts
// (stroke/fill/tick) и inline-стили. Значения берутся из той же палитры, что и
// утилиты Tailwind (src/ui/palette.js), поэтому смена бренд-цвета перекрашивает
// и графики тоже.

import { palette } from './palette.js'

export const CHART = {
  /** Основная линия/бар — бренд. */
  brand: palette.brand,
  /** Контрастная вторая серия (зарплаты, отмены). */
  ink: palette.ink,
  /** Подписи осей. */
  tick: palette['ink-faint'],
  /** Сетка (dashed). */
  grid: palette['line-soft'],
  /** Рамка тултипа. */
  border: palette.line,
  /** Фон тултипа. */
  surface: '#fff',

  /** Семантические серии графиков (собственная шкала, вне бренд-палитры). */
  positive: '#16a34a',
  negative: '#dc2626',
  warning: '#f59e0b',
  mint: '#82ca9d',
} as const

/**
 * Палитра категорий расходов (розовые оттенки, порядок = порядок категорий).
 * Первый цвет — брендовый, остальные подобраны к нему.
 */
export const EXPENSE_COLORS = [
  palette.brand,
  '#ff6b9d',
  '#c41e3a',
  '#ff1744',
  '#d81b60',
  '#e91e63',
  '#f06292',
  '#ec407a',
  '#ad1457',
  '#880e4f',
] as const
