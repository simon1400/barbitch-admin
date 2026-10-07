// Состояние карточки «Сегодня» по счётчику (s245) — один источник правды для самой
// карточки (TodayCard) и для строки «✓ В порядке» на странице: ошибка источника важнее
// всего, 0 — «в порядке», null — информационная карточка.
export type CardState = 'loading' | 'error' | 'attention' | 'ok' | 'info'

export const cardState = (count: number | null, loading: boolean, error?: string | null): CardState =>
  loading ? 'loading' : error ? 'error' : count != null && count > 0 ? 'attention' : count === 0 ? 'ok' : 'info'
