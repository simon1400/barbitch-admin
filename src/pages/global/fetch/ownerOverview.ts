// «Сейчас» на главной владельца (s258): касса и последняя закрытая смена — одна ручка
// движка `GET /engine/admin/overview` (только владелец). Не зависит от выбранного месяца
// и в кэш месяца не входит: это состояние на текущий момент.
import { makeApiFetch } from '../../../lib/apiFetch'

export interface OverviewCash {
  /** день записи кассы (YYYY-MM-DD) */
  date: string | null
  /** остаток в кассе после этой смены */
  balance: number
  /** приход за смену (строки потока ≥ 0) */
  income: number
  /** расход за смену (строки потока < 0, отрицательное число) */
  outflow: number
  /** кто заполнял (имя записи или карточка) */
  name: string
  /** запись опубликована закрытием смены */
  closed: boolean
}

export interface OverviewLastShift {
  date: string
  closedAt: string | null
  by: string
  published: number
  /** результат месяца до → после публикации; null у закрытий до s258 */
  result: { before: number; after: number } | null
}

export interface OwnerOverview {
  cash: OverviewCash | null
  lastShift: OverviewLastShift | null
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Сессия истекла — войдите заново.',
  owner_only: 'Доступно только владельцу.',
}

const overviewFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

export const fetchOwnerOverview = () => overviewFetch<OwnerOverview>('GET', '/overview')
