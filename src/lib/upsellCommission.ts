/* eslint-disable @typescript-eslint/no-explicit-any */
// Комиссия администратора за дозапись (модуль «Дозаписи», s197) — черновик
// «Доп. заработка» с source='upsell' и связью booking.
//
// 🟥 Одно правило на два места денежного пути: закрытие смены ПУБЛИКУЕТ только
// комиссии закрытых визитов, и предпросмотр результата месяца обязан сложить
// ровно их же — иначе «Čistý zisk směny» в предпросмотре разошёлся бы с итогом.
// Ручные записи владельца (без source) закрытие смены не трогает вовсе.

export const UPSELL_SOURCE = 'upsell'

export type UpsellCommissionState = 'ready' | 'visit_open' | 'visit_cancelled' | 'no_booking'

export const upsellCommissionState = (item: any): UpsellCommissionState => {
  const status = item?.booking?.status
  if (!status) return 'no_booking'
  if (status === 'checkedOut') return 'ready'
  if (status === 'cancelled' || status === 'noshow') return 'visit_cancelled'
  return 'visit_open'
}

/** Публикуется ли комиссия при закрытии смены. */
export const isPublishableUpsellCommission = (item: any): boolean =>
  item?.source === UPSELL_SOURCE && upsellCommissionState(item) === 'ready'
