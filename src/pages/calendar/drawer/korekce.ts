// «Korekce zdarma — převod podílu» (s210): чистая логика для шторки брони и формы
// закрытия визита. Формулы — зеркало strapi/.../korekce-transfer.ts (сервер всё
// равно считает сам; здесь только живая подсказка, пока админ печатает).

import type { KorekceCandidate, KorekceTransfer, VisitCheckoutHint } from '../fetch/engineApi'
import { dec } from '../../../utils/money'

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

/** «2026-09-20» → «20. 9.» */
export const csDay = (ymd: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m ? `${Number(m[3])}. ${Number(m[2])}.` : String(ymd || '')
}

const CS_MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
export const csMonth = (ymd: string | null | undefined): string => {
  const m = /^\d{4}-(\d{2})/.exec(String(ymd || ''))
  return m ? CS_MONTHS[Number(m[1]) - 1] || '' : ''
}

export const signedKc = (n: number): string => (n > 0 ? `+${dec(n)}` : n < 0 ? `−${dec(-n)}` : '±0')

/** Число из поля формы (запятая допустима); пусто/мусор → null. */
export const parseKc = (s: string): number | null => {
  const t = String(s || '').trim().replace(',', '.').replace(/\s/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Суммы переноса: те же формулы, что на сервере (salonAdj = разность округлённых долей). */
export const korekceAmounts = (baseKc: number, rateA: number, rateB: number) => {
  const staffOutKc = round2((baseKc * rateA) / 100)
  const staffInKc = round2((baseKc * rateB) / 100)
  return { staffOutKc, staffInKc, salonAdjKc: round2(staffOutKc - staffInKc) }
}

/**
 * Подсказка «сколько положено» с учётом переноса:
 *   бронь-коррекция (ok)   → мастер = base × rB, салон 0;
 *   тот же мастер          → 0 / 0;
 *   исходный визит         → сервер уже вычел долю из hint.mustStaff, салон сдвигается на salonAdj.
 */
export const korekceMust = (
  hint: VisitCheckoutHint,
  form: { internal: boolean; korekceBase: string },
  saleKc: number,
): { mustStaff: number; mustSalon: number } => {
  const k = hint.korekce
  if (k?.status === 'ok') {
    const base = parseKc(form.korekceBase) ?? 0
    return { mustStaff: round2((base * (k.rateB || 0)) / 100), mustSalon: 0 }
  }
  if (k?.status === 'same_master') return { mustStaff: 0, mustSalon: 0 }
  const out = hint.korekceOut?.staffOutKc || 0
  const adj = hint.korekceOut?.salonAdjKc || 0
  const mustStaff = hint.mustStaff
  if (form.internal) return { mustStaff, mustSalon: 0 }
  return { mustStaff, mustSalon: round2(hint.paidExpected - saleKc - (mustStaff + out) + adj) }
}

/** Подпись визита в селекте «po které návštěvě». */
export const candidateLabel = (c: KorekceCandidate): string =>
  [
    csDay(c.date),
    c.master || '—',
    c.services || '—',
    c.totalPrice != null ? `${dec(c.totalPrice)} Kč` : null,
  ]
    .filter(Boolean)
    .join(' · ') + (c.hasRecord ? '' : ' (návštěva není uzavřená)')

/** Строка в карточке закрытого визита-коррекции. */
export const transferSummary = (t: KorekceTransfer): string => {
  if (t.mode === 'same_master') return `🔁 po vlastní návštěvě ${csDay(t.originalDate)} — bez převodu`
  const head = `🔁 po ${csDay(t.originalDate)} (${t.originalMaster})`
  if (t.mode === 'payroll') return `${head}: +${dec(t.staffInKc)} Kč · odpis ${t.originalMaster} −${t.payrollKc} Kč`
  const tail = t.pending ? ' · čeká na uzavření původní návštěvy' : ''
  return `${head}: −${dec(t.staffOutKc)} / +${dec(t.staffInKc)} / salon ${signedKc(t.salonAdjKc)} Kč${tail}`
}

/** Строка в карточке закрытого ИСХОДНОГО визита (аккумуляторы переноса). */
export const outSummary = (staffOutKc: number | null | undefined, salonAdjKc: number | null | undefined): string | null => {
  const out = Number(staffOutKc) || 0
  const adj = Number(salonAdjKc) || 0
  if (!out && !adj) return null
  return `🔁 podíl převeden na korekci: mistr −${dec(out)} Kč, salon ${signedKc(adj)} Kč`
}
