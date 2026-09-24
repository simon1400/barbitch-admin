/* eslint-disable @typescript-eslint/no-explicit-any */
// Verify-флаги сверки смены: пересчёт «как должно быть» по записи оказанной услуги
// и разбор расхождений (getItemFlags) плюс денежная дельта одного флага
// (getFlagDelta). Вынесено из fetch/shiftClose.ts ДОСЛОВНО (этап 6 аудита).
//
// ⚠️ getItemFlags/getFlagDelta реэкспортируются из fetch/shiftClose.ts:
// ServiceProvidedCard импортирует их ИМЕННО оттуда — публичная поверхность
// модуля распилом меняться не имеет права.
import { VERIFY_FLAGS, type VerifyFlag, parseSaleRate } from '../../../../lib/verifyFlags'

// Цены хранятся строками; junior-цены (−20%) бывают с запятой ("237,6").
// Number("237,6") = NaN → 0. Нормализуем запятую перед парсом.
const toNum = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

const computeMustValues = (
  offerPrice: number,
  ratePercent: number,
  sale: unknown,
) => {
  const discountRate = parseSaleRate(sale, offerPrice)
  const hasSale = discountRate > 0
  const mustStaff = offerPrice * (ratePercent / 100)
  const mustSalonNow = hasSale
    ? offerPrice * (1 - discountRate) - mustStaff
    : offerPrice - mustStaff
  return { mustStaff, mustSalonNow, hasSale }
}

const computeFlagsFromValues = (
  offerPrice: number,
  ratePercent: number,
  staffSalaries: number,
  salonSalaries: number,
  sale: unknown,
  internal: boolean,
): VerifyFlag[] => {
  const { mustStaff, mustSalonNow, hasSale } = computeMustValues(offerPrice, ratePercent, sale)
  // Round to whole crowns before comparing — kills float noise (e.g. 1112*0.3 =
  // 333.59999999999997) that otherwise makes an exact 333.6 false-flag mistr_up/ztrata.
  const r = (n: number) => Math.round(n * 100) / 100

  // Internal worker-to-worker service: salon profit 0 is normal → only check master %.
  if (internal) {
    const flags: VerifyFlag[] = ['internal']
    if (r(staffSalaries) > r(mustStaff)) flags.push('mistr_up')
    if (r(staffSalaries) < r(mustStaff)) flags.push('mistr_down')
    return flags
  }

  const flags: VerifyFlag[] = []
  if (r(staffSalaries) > r(mustStaff)) flags.push('mistr_up')
  if (r(staffSalaries) < r(mustStaff)) flags.push('mistr_down')
  if (r(salonSalaries) > r(mustSalonNow)) flags.push('salon_up')
  if (r(salonSalaries) < r(mustSalonNow)) flags.push('ztrata')
  if (hasSale) flags.push('sleva')
  if (flags.length === 0) flags.push('ok')
  return flags
}

// A required money field that was never filled (null / "" / whitespace). A genuine
// zero ("0", e.g. internal service) is NOT blank.
const isBlankMoney = (v: unknown): boolean => v == null || String(v).trim() === ''

// Resolve flags for a service-provided item.
// Priority: recompute-when-incomplete → stored verifyFlags → recompute (legacy) → empty
export const getItemFlags = (item: any): VerifyFlag[] => {
  const offerPrice = Number(item?.offer?.price)
  const ratePercent = Number(item?.personal?.ratePercent)
  const canRecompute =
    Number.isFinite(offerPrice) && Number.isFinite(ratePercent) && offerPrice > 0

  // 🟥 Never show a green tick for a record whose master/salon price was left empty.
  // A partial publish could have overwritten verifyFlags with ['ok'], so when a
  // required money field is blank (and it's not an internal service) recompute live
  // from the populated relations — an empty field parses to 0 and surfaces the real
  // ztráta/mistr_down instead of trusting the stale stored flag.
  const internal = Boolean(item?.internal)
  const incomplete =
    !internal &&
    (isBlankMoney(item?.staffSalaries) || isBlankMoney(item?.salonSalaries))
  if (incomplete && canRecompute) {
    return computeFlagsFromValues(
      offerPrice,
      ratePercent,
      toNum(item?.staffSalaries),
      toNum(item?.salonSalaries),
      item?.sale,
      internal,
    )
  }

  if (Array.isArray(item?.verifyFlags) && item.verifyFlags.length > 0) {
    return item.verifyFlags.filter((f: unknown): f is VerifyFlag =>
      typeof f === 'string' && (VERIFY_FLAGS as string[]).includes(f),
    )
  }
  // Legacy fallback: recompute from raw data if relations were populated
  if (canRecompute) {
    return computeFlagsFromValues(
      offerPrice,
      ratePercent,
      toNum(item?.staffSalaries),
      toNum(item?.salonSalaries),
      item?.sale,
      internal,
    )
  }
  return []
}

// Подсказка чипа 🔁 (s210): откуда/куда ушла доля мастера
const csDay = (ymd: unknown): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m ? `${Number(m[3])}. ${Number(m[2])}.` : ''
}
export const korekceTitle = (item: any): string => {
  const k = item?.korekce
  if (k?.mode === 'same_master') return `Korekce u stejné mistrové (po ${csDay(k.originalDate)}) — bez převodu`
  if (k?.mode === 'payroll') {
    return `Korekce po návštěvě ${csDay(k.originalDate)} (${k.originalMaster}): +${toNum(k.staffInKc)} Kč, odpis ze mzdy ${k.originalMaster} −${toNum(k.payrollKc)} Kč`
  }
  if (k?.mode === 'record') {
    return `Korekce po návštěvě ${csDay(k.originalDate)} (${k.originalMaster}): +${toNum(k.staffInKc)} Kč, u ${k.originalMaster} −${toNum(k.staffOutKc)} Kč`
  }
  const out = toNum(item?.korekceStaffOutKc)
  const adj = toNum(item?.korekceSalonAdjKc)
  return `Podíl převeden na korekci: mistr −${out} Kč, salon ${adj > 0 ? '+' : adj < 0 ? '−' : '±'}${Math.abs(adj)} Kč`
}

// Numeric delta for the given flag — used in tooltips, e.g. "+50 Kč" / "−30 Kč"
export const getFlagDelta = (item: any, flag: VerifyFlag): number | null => {
  // 💰 дельта хранится в записи (сервер считает её с учётом bitchcard) — до
  // проверки offer.price: у booking-записей оффера нет
  if (flag === 'cena_rucne') return item?.manualDeltaKc == null ? null : toNum(item.manualDeltaKc)
  // 🔁 перенос доли (s210): у записи коррекции — доля исправителя, у исходной — ушедшая доля
  if (flag === 'korekce') {
    const k = item?.korekce
    if (k?.mode === 'record' || k?.mode === 'payroll') return toNum(k.staffInKc)
    const out = toNum(item?.korekceStaffOutKc)
    return out ? -out : null
  }
  const offerPrice = Number(item?.offer?.price)
  const ratePercent = Number(item?.personal?.ratePercent)
  if (!Number.isFinite(offerPrice) || !Number.isFinite(ratePercent) || offerPrice <= 0) return null
  const { mustStaff, mustSalonNow } = computeMustValues(offerPrice, ratePercent, item?.sale)
  const r = (n: number) => Math.round(n * 100) / 100
  const staffDelta = r(toNum(item?.staffSalaries) - mustStaff)
  const salonDelta = r(toNum(item?.salonSalaries) - mustSalonNow)
  switch (flag) {
    case 'salon_up': return salonDelta
    case 'ztrata':   return salonDelta
    case 'mistr_up': return staffDelta
    case 'mistr_down': return staffDelta
    case 'sleva':    return null // informational tag, no delta
    default: return null
  }
}
