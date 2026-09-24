/* eslint-disable @typescript-eslint/no-explicit-any */
// Черновики «Списывания с зарплаты» (payroll), которые заводит ДВИЖОК, а не владелец:
//   • source='internal' — списание за интерную услугу (модуль «Interní rezervace», s203);
//   • source='korekce'  — мастер оплачивает долю исправителя за бесплатную коррекцию
//     визита из прошлого месяца («Korekce zdarma — převod podílu», s210).
// У обоих связь `booking` → бронь, после которой запись имеет смысл.
//
// 🟥 Одно правило на два места денежного пути, как у комиссии за дозапись
// ([[upsellCommission]]): закрытие смены ПУБЛИКУЕТ только списания закрытых визитов,
// и предпросмотр результата месяца обязан вычесть ровно их же — иначе итог смены
// разошёлся бы с предпросмотром.
//
// Ручные `payroll` владельца (без source) закрытие смены публикует как раньше —
// гейт смотрит ТОЛЬКО на source движка.

export const INTERNAL_PAYROLL_SOURCE = 'internal'
export const KOREKCE_PAYROLL_SOURCE = 'korekce'
const ENGINE_PAYROLL_SOURCES = [INTERNAL_PAYROLL_SOURCE, KOREKCE_PAYROLL_SOURCE]

export type InternalPayrollState = 'ready' | 'visit_open' | 'visit_cancelled' | 'no_booking'

export const internalPayrollState = (item: any): InternalPayrollState => {
  const status = item?.booking?.status
  if (!status) return 'no_booking'
  if (status === 'checkedOut') return 'ready'
  if (status === 'cancelled' || status === 'noshow') return 'visit_cancelled'
  return 'visit_open'
}

/** Только черновики ДВИЖКА: ручные записи владельца (без source) сюда не попадают. */
export const isEnginePayrollItem = (item: any): boolean => ENGINE_PAYROLL_SOURCES.includes(item?.source)

/** Списание за бесплатную коррекцию (подпись в карточке закрытия смены). */
export const isKorekcePayrollItem = (item: any): boolean => item?.source === KOREKCE_PAYROLL_SOURCE

/** Публикуется ли списание при закрытии смены. */
export const isPublishableEnginePayroll = (item: any): boolean =>
  isEnginePayrollItem(item) && internalPayrollState(item) === 'ready'
