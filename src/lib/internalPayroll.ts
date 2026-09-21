/* eslint-disable @typescript-eslint/no-explicit-any */
// Списание с зарплаты за интерную услугу (модуль «Interní rezervace», s203) —
// черновик «Списывания с зарплаты» (payroll) с source='internal' и связью booking.
//
// 🟥 Одно правило на два места денежного пути, как у комиссии за дозапись
// ([[upsellCommission]]): закрытие смены ПУБЛИКУЕТ только списания закрытых визитов,
// и предпросмотр результата месяца обязан вычесть ровно их же — иначе итог смены
// разошёлся бы с предпросмотром.
//
// Ручные `payroll` владельца (без source) закрытие смены публикует как раньше —
// гейт смотрит ТОЛЬКО на source='internal'.

export const INTERNAL_PAYROLL_SOURCE = 'internal'

export type InternalPayrollState = 'ready' | 'visit_open' | 'visit_cancelled' | 'no_booking'

export const internalPayrollState = (item: any): InternalPayrollState => {
  const status = item?.booking?.status
  if (!status) return 'no_booking'
  if (status === 'checkedOut') return 'ready'
  if (status === 'cancelled' || status === 'noshow') return 'visit_cancelled'
  return 'visit_open'
}

/** Публикуется ли списание при закрытии смены. */
export const isPublishableInternalPayroll = (item: any): boolean =>
  item?.source === INTERNAL_PAYROLL_SOURCE && internalPayrollState(item) === 'ready'

/** Только НАШИ черновики: ручные записи владельца (без source) сюда не попадают. */
export const isInternalPayrollItem = (item: any): boolean => item?.source === INTERNAL_PAYROLL_SOURCE
