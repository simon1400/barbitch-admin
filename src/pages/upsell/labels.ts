// Подписи и тексты модуля «Дозаписи» — отдельно от компонентов
// (react-refresh запрещает файлу с компонентами экспортировать ещё и константы).
import { kc } from '../../utils/money'
import type { UpsellMode, UpsellOffer, UpsellService, UpsellState } from './fetch/upsellApi'

export const MODE_LABEL: Record<UpsellMode, string> = { after: 'hned po', before: 'před' }

export const STATE_LABEL: Record<UpsellState, string> = {
  awaiting_visit: 'ждёт визита',
  awaiting_confirmation: 'ждёт подтверждения',
  confirmed: 'подтверждено',
  cancelled: 'отменена',
  no_commission: 'без комиссии',
}

/** Текст подтверждения перед дозаписью — всё, что уйдёт в бронь, одним взглядом. */
export const confirmText = (clientName: string, offer: UpsellOffer, svc: UpsellService): string =>
  [
    `Дозаписать ${clientName}?`,
    '',
    `${svc.title} · ${offer.employeeName}`,
    `${svc.startTime}–${svc.endTime} (${MODE_LABEL[offer.mode]})`,
    `Цена для клиента: ${kc(svc.discountedPrice)} (вместо ${kc(svc.price)})`,
    `Вам: +${kc(svc.commissionKc)}`,
  ].join('\n')
