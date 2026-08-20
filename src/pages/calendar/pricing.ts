// Цены брони для показа в календаре.
//
// 🟥 ПРАВИЛО САЛОНА (s47/s152/s153): мастер ВСЕГДА получает свой процент от ПОЛНОЙ
// цены услуги — системную скидку (bitchcard-награда, дозапись −15 %) съедает САЛОН,
// не мастер. `booking.totalPrice` = уже оплаченная (сниженная) сумма, поэтому делить
// на процент её НЕЛЬЗЯ — так мастеру показывалась заниженная доля (жалоба мастеров).
//
// Этот модуль — клиентское зеркало серверного `bookingPricing`
// (strapi/src/utils/verify-flags.ts), по которому считается подсказка при закрытии
// визита и verify-флаги. Если меняется одна сторона — править обе.
import type { CalendarBooking } from './fetch/calendarDay'

const money = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Скидка за дозапись (rebook −15 %, s133) — прямо из booking.discount, пока applied. */
export const rebookDiscountKc = (b: CalendarBooking): number => {
  const d = b.discount
  return d && d.type === 'rebook' && d.applied ? Math.max(0, money(d.discountKc)) : 0
}

/**
 * Полная цена визита = та, от которой мастеру считается процент.
 *
 * ⚠️ `priceOverride` НЕ означает «цену задал админ» — этот флаг взводят и системные
 * скидки (bitchcard/дозапись), оставляя в снапшоте `services[].price` полные цены.
 * Поэтому: с override полная цена = оплачено + известные системные скидки (ручной
 * договорной прайс так и остаётся реальной ценой), без override = Σ снапшота.
 * Юниор-скидка (−20 %) в снапшоте УЖЕ учтена (`price` = юниор-цена) и салоном НЕ
 * компенсируется — это цена услуги, а не скидка клиенту.
 */
export const bookingFullPrice = (b: CalendarBooking): number | null => {
  const sum = (b.services || []).reduce((acc, s) => acc + money(s?.price), 0)
  const systemKc = rebookDiscountKc(b) + Math.max(0, money(b.redemptionKc))
  if (b.priceOverride) return b.totalPrice == null ? null : money(b.totalPrice) + systemKc
  if (sum > 0) return sum
  return b.totalPrice == null ? null : money(b.totalPrice) + systemKc
}

/** Доля мастера = процент от ПОЛНОЙ цены (скидка остаётся на салоне). */
export const masterShare = (b: CalendarBooking, ratePercent: number): number | null => {
  const full = bookingFullPrice(b)
  return full == null ? null : Math.round((full * ratePercent) / 100)
}

/** Есть ли на брони системная скидка (для пометки «slevu nese salon»). */
export const hasSystemDiscount = (b: CalendarBooking): boolean =>
  rebookDiscountKc(b) > 0 || money(b.redemptionKc) > 0
