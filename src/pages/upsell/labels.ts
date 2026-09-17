// Подписи и тексты модуля «Дозаписи» — отдельно от компонентов
// (react-refresh запрещает файлу с компонентами экспортировать ещё и константы).
import { kc } from '../../utils/money'
import type {
  UpsellManualOutcome,
  UpsellMode,
  UpsellOffer,
  UpsellReportOutcome,
  UpsellService,
  UpsellState,
} from './fetch/upsellApi'

/** Якорь секции «Мои дозаписи за месяц» — ссылка «Список» из полосы месяца. */
export const MINE_SECTION_ID = 'upsell-month'

export const MODE_LABEL: Record<UpsellMode, string> = { after: 'hned po', before: 'před' }

export const STATE_LABEL: Record<UpsellState, string> = {
  awaiting_visit: 'ждёт визита',
  awaiting_confirmation: 'ждёт подтверждения',
  confirmed: 'подтверждено',
  cancelled: 'отменена',
  no_commission: 'без комиссии',
}

/** Результат предложения (s199). Ключи совпадают с серверными. */
export const OUTCOME_LABEL: Record<UpsellReportOutcome, string> = {
  booked: 'Дозаписан',
  site: 'Дозапись с сайта',
  declined: 'Отказ',
  not_offered: 'Не предлагали',
  missing: 'Не отмечено',
}

/** Порядок причин — как в кнопках. Ключи хранит сервер (UPSELL_RESULT_REASONS). */
export const RESULT_REASONS: Record<UpsellManualOutcome, { key: string; label: string }[]> = {
  declined: [
    { key: 'no_time', label: 'Нет времени' },
    { key: 'price', label: 'Дорого' },
    { key: 'not_interested', label: 'Не интересно' },
    { key: 'own_master', label: 'Есть свой мастер' },
    { key: 'later', label: 'Запишется позже сама' },
    { key: 'other', label: 'Другое' },
  ],
  not_offered: [
    { key: 'no_slots', label: 'Не было окон' },
    { key: 'client_busy', label: 'Неудобно подойти' },
    { key: 'admin_busy', label: 'Не успела — много работы' },
    { key: 'client_left', label: 'Клиент уже ушёл' },
    { key: 'other', label: 'Другое' },
  ],
}

export const reasonLabel = (outcome: string, reason: string | null): string =>
  (reason && RESULT_REASONS[outcome as UpsellManualOutcome]?.find((r) => r.key === reason)?.label) || reason || ''

/** Русское склонение по числу: plural(3, ['мастер', 'мастера', 'мастеров']). */
export const plural = (n: number, forms: [string, string, string]): string => {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/** «2 мастера свободны» — подпись в заголовке группы режима. */
export const freeMastersLabel = (n: number): string =>
  `${n} ${plural(n, ['мастер свободен', 'мастера свободны', 'мастеров свободны'])}`

/** «3 дозаписи» — подпись в полосе месяца. */
export const upsellCountLabel = (n: number): string => `${n} ${plural(n, ['дозапись', 'дозаписи', 'дозаписей'])}`

/** Инициалы клиента для аватара: «Tereza Nováková» → «TN». */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const s = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return s || '?'
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
