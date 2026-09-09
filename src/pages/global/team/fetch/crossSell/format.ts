// Время и дата для письма о дозаписи. Перенесено из windowCrossSell.ts
// (этап 6) дословно.
import { isoToMinPrague } from '../../../../../utils/date'

// ─── Время ──────────────────────────────────────────────────────────────────
// 🟥 Было `d.getHours()` — часы БРАУЗЕРА, см. тот же разбор в scheduleGaps:
// предложение «окна» клиенту уезжало бы на часовой пояс владельца (s186).
export const isoToMin = (iso: string): number => isoToMinPrague(iso) ?? 0
// '2026-06-16' → '16. 6. 2026' — текст письма, НЕ 'DD.MM.YYYY' из utils/date
export const fmtCsDateLong = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
