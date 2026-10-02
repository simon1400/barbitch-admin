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
const rebookDiscountKc = (b: CalendarBooking): number => {
  const d = b.discount
  return d && d.type === 'rebook' && d.applied ? Math.max(0, money(d.discountKc)) : 0
}

/**
 * Полная цена визита = та, от которой мастеру считается процент. Одно правило с
 * формой закрытия визита и verify-флагами (серверный `bookingPricing`):
 *   • Σ снапшота `services[].price` ВСЕГДА (s203): системную скидку и ручное
 *     занижение цены несёт салон. Юниор-скидка (−20 %) в снапшоте уже учтена
 *     (`price` = юниор-цена) — это цена услуги, а не скидка клиенту;
 *   • визит закрыт с причиной ручной цены «меньшая работа» (`priceBasis: 'paid'`,
 *     s241) → цена брони до системных скидок;
 *   • снапшот без цен (легаси) → оплачено + известные системные скидки;
 *   • бесплатная коррекция (s210): 0 Kč — правило, долю мастер получает переносом
 *     с исходного визита, а не от каталожной цены.
 * До s241 при `priceOverride` базой была цена брони — мастеру на плитке показывалась
 * доля от заниженной руками цены, а при закрытии визита считалась от каталожной.
 */
export const bookingFullPrice = (b: CalendarBooking): number | null => {
  const sum = (b.services || []).reduce((acc, s) => acc + money(s?.price), 0)
  const systemKc = rebookDiscountKc(b) + Math.max(0, money(b.redemptionKc))
  const paidBase = b.totalPrice == null ? null : money(b.totalPrice) + systemKc
  const freeKorekce = b.korekce === true && !(money(b.totalPrice) > 0)
  const lessWork = b.priceBasis === 'paid' && paidBase != null && paidBase < sum
  if (sum > 0 && !freeKorekce && !lessWork) return sum
  return paidBase
}

/** Доля мастера = процент от ПОЛНОЙ цены (скидка остаётся на салоне). */
export const masterShare = (b: CalendarBooking, ratePercent: number): number | null => {
  const full = bookingFullPrice(b)
  return full == null ? null : Math.round((full * ratePercent) / 100)
}

