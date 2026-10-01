// Затраты салона (s236, план EXPENSES_NEXT_SESSION_PROMPT.md, Фаза 1).
//
// Читает и пишет только серверная ручка движка (`/engine/admin/costs`, руководство):
// белый список полей, автор из сессии, журнал, одобрение владельцем правок
// управляющей. Сырой `/api/costs` на запись закрыт сервером всем сессиям.
//
// 🟥 Итоги месяца кэшируются (прошлый месяц — навсегда, monthDataCache), поэтому
// после каждой записи, правки, удаления и одобрения сбрасывается кэш месяца
// СТАРОЙ и НОВОЙ даты затраты — иначе «Результат за месяц» показывал бы старое.
import { makeApiFetch } from '../../../lib/apiFetch'
import { invalidateGlobalMonthData } from '../../dashboard/fetch/monthDataCache'

export type CostPayment = 'card' | 'cash' | 'transfer' | 'owner'
/** Ставка DPH: 21 / 12 / без DPH / вручную (смешанный чек — сумма без DPH вводится руками). */
export type CostVat = 21 | 12 | 0 | 'manual'
export type CostRequestAction = 'edit' | 'delete'

// Порядок — порядок селекта в форме.
export const PAYMENT_LABELS: Record<CostPayment, string> = {
  card: 'Karta salonu',
  cash: 'Hotovost z kasy',
  transfer: 'Převod',
  owner: 'Zaplatil majitel osobně',
}
export const PAYMENT_ORDER = Object.keys(PAYMENT_LABELS) as CostPayment[]

export const VAT_OPTIONS: { value: CostVat; label: string }[] = [
  { value: 21, label: '21 %' },
  { value: 12, label: '12 %' },
  { value: 0, label: 'bez DPH' },
  { value: 'manual', label: 'вручную' },
]

/** Подтверждение суммы — выше этого (максимум за 1,5 года — 17 000); потолок сервера — 300 000. */
export const CONFIRM_SUM_KC = 30000
export const MAX_SUM_KC = 300000

/** Поля, которые правятся. */
export interface CostFields {
  date: string
  name: string
  category: string
  sum: number
  noDph: number
  payment: CostPayment | null
  comment: string | null
}

export interface CostRow extends CostFields {
  documentId: string
  vat: CostVat
  /** логин того, кто внёс; null — внесено в панели Strapi */
  author: string | null
  viaPanel: boolean
  files: number
  pendingRequest: { id: string; action: CostRequestAction; requestedBy: string | null } | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CostRequest {
  id: string
  costDocId: string
  action: CostRequestAction
  changes: Partial<CostFields> | null
  before: CostFields | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requestedBy: string | null
  createdAt: string | null
  /** затрата сейчас; null — её уже нет */
  cost: CostRow | null
}

export interface CostsMonth {
  month: string
  rows: CostRow[]
  categories: string[]
  payments: CostPayment[]
  /** владелец — все ожидающие запросы, управляющая — свои */
  pending: CostRequest[]
}

export interface CostSuggestion {
  name: string
  category: string | null
  vat: CostVat
  payment: CostPayment | null
  lastSum: number
  lastDate: string
  count: number
}

/** Тело создания / правки: всё, что в форме. */
export interface CostInput {
  date: string
  name: string
  category: string
  sum: number
  noDph: number
  payment: CostPayment
  comment: string
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Это действие доступно только владельцу.',
  unauthorized: 'Сессия истекла — войдите снова.',
  bad_month: 'Неверный месяц.',
  name_required: 'Напишите название.',
  name_too_long: 'Название слишком длинное (до 120 символов).',
  bad_category: 'Выберите категорию.',
  bad_sum: 'Сумма — целое положительное число крон.',
  sum_too_big: 'Сумма больше 300 000 Kč — проверьте, нет ли лишнего нуля.',
  bad_no_dph: 'Сумма без DPH — целые кроны, не больше суммы.',
  payment_required: 'Выберите способ оплаты.',
  bad_payment: 'Неизвестный способ оплаты.',
  bad_date: 'Неверная дата.',
  date_too_far: 'Дата слишком далеко в будущем.',
  text_too_long: 'Комментарий слишком длинный (до 500 символов).',
  no_changes: 'Ничего не изменилось.',
  not_found: 'Затрата не найдена — возможно, её уже удалили.',
  approval_required: 'Изменить или удалить затрату можно только через одобрение владельца.',
  owner_direct: 'Владелец правит и удаляет затраты сразу, без запроса.',
  bad_action: 'Неизвестный тип запроса.',
  request_pending: 'По этой затрате уже есть запрос — дождитесь решения владельца.',
  request_not_found: 'Запрос не найден.',
  request_closed: 'Запрос уже решён или отозван.',
  not_your_request: 'Отозвать запрос может только тот, кто его подал.',
  cost_changed: 'Затрату изменили после запроса — проверьте актуальные данные и решите заново.',
}

const costsFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

const pad2 = (n: number) => String(n).padStart(2, '0')

/** month — 0-based, как у useMonthYear. */
export const monthKey = (month: number, year: number) => `${year}-${pad2(month + 1)}`

/** Сумма без DPH по ставке — так же, как сервер (`noDphFor`). */
export const noDphFor = (sum: number, vat: number): number => (vat ? Math.round(sum / (1 + vat / 100)) : sum)

/** «Nájem», «najem » и «NAJEM» — одно название (как ключ автодополнения на сервере). */
export const nameKey = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

// Кэш итогов месяца — по дате затраты (она может быть вне открытого месяца).
const invalidateMonthOf = (ymd: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(ymd ?? ''))
  if (m) invalidateGlobalMonthData(Number(m[2]) - 1, Number(m[1]))
}

export const fetchCostsMonth = async (month: number, year: number): Promise<CostsMonth> => {
  const res = await costsFetch<CostsMonth>('GET', `/costs?month=${monthKey(month, year)}`)
  return {
    month: res?.month ?? monthKey(month, year),
    rows: Array.isArray(res?.rows) ? res.rows : [],
    categories: Array.isArray(res?.categories) ? res.categories : [],
    payments: Array.isArray(res?.payments) ? res.payments : PAYMENT_ORDER,
    pending: Array.isArray(res?.pending) ? res.pending : [],
  }
}

export const fetchCostSuggestions = async (): Promise<CostSuggestion[]> => {
  const res = await costsFetch<{ items: CostSuggestion[] }>('GET', '/costs/suggest')
  return Array.isArray(res?.items) ? res.items : []
}

export const createCost = async (input: CostInput): Promise<CostRow> => {
  const res = await costsFetch<{ row: CostRow }>('POST', '/costs', input)
  invalidateMonthOf(input.date)
  return res.row
}

/** Правка владельцем — сразу. Сбрасывается кэш и старого, и нового месяца (дату могли перенести). */
export const updateCost = async (row: Pick<CostRow, 'documentId' | 'date'>, changes: Partial<CostInput>): Promise<CostRow> => {
  const res = await costsFetch<{ row: CostRow }>('PATCH', `/costs/${encodeURIComponent(row.documentId)}`, changes)
  invalidateMonthOf(row.date)
  invalidateMonthOf(res.row?.date)
  return res.row
}

export const deleteCost = async (row: Pick<CostRow, 'documentId' | 'date'>): Promise<void> => {
  await costsFetch('DELETE', `/costs/${encodeURIComponent(row.documentId)}`)
  invalidateMonthOf(row.date)
}

/** Запрос управляющей: деньги не меняются до одобрения — кэш не трогаем. */
export const requestCostChange = async (
  row: Pick<CostRow, 'documentId'>,
  action: CostRequestAction,
  changes?: Partial<CostInput>,
): Promise<CostRequest> => {
  const res = await costsFetch<{ request: CostRequest }>(
    'POST',
    `/costs/${encodeURIComponent(row.documentId)}/requests`,
    action === 'edit' ? { action, changes } : { action },
  )
  return res.request
}

export const cancelCostRequest = async (id: string): Promise<void> => {
  await costsFetch('DELETE', `/costs/requests/${encodeURIComponent(id)}`)
}

/** Одобрение: применённая правка или удаление — сброс кэша обоих месяцев. */
export const approveCostRequest = async (id: string): Promise<{ row: CostRow | null; deleted: string | null }> => {
  const res = await costsFetch<{ row: CostRow | null; deleted: string | null; before: CostFields | null }>(
    'POST',
    `/costs/requests/${encodeURIComponent(id)}/approve`,
  )
  invalidateMonthOf(res.before?.date)
  invalidateMonthOf(res.row?.date)
  return { row: res.row ?? null, deleted: res.deleted ?? null }
}

export const rejectCostRequest = async (id: string, note: string): Promise<void> => {
  await costsFetch('POST', `/costs/requests/${encodeURIComponent(id)}/reject`, { note })
}

/**
 * Затраты месяца для прогноза (analytics/fetch/forecast.ts). Ошибка не глотается:
 * раньше она превращалась в «затрат нет», и прогноз молча завышал результат.
 */
export const getExpenses = async (month: number, year: number): Promise<CostRow[]> =>
  (await fetchCostsMonth(month, year)).rows

/** Что поменялось в форме относительно строки — только эти поля уходят в правку / запрос. */
export const diffInput = (row: CostFields, input: CostInput): Partial<CostInput> => {
  const out: Partial<CostInput> = {}
  const comment = input.comment.trim()
  if (input.date !== row.date) out.date = input.date
  if (input.name.trim() !== row.name) out.name = input.name.trim()
  if (input.category !== row.category) out.category = input.category
  if (input.sum !== row.sum) out.sum = input.sum
  if (input.noDph !== row.noDph) out.noDph = input.noDph
  if (input.payment !== row.payment) out.payment = input.payment
  if (comment !== (row.comment ?? '')) out.comment = comment
  return out
}

/**
 * Возможный дубль: та же дата и то же название или та же сумма — среди записей
 * открытого месяца (кроме самой правимой записи).
 */
export const findDuplicates = (
  rows: CostRow[],
  input: Pick<CostInput, 'date' | 'name' | 'sum'>,
  exceptId?: string,
): CostRow[] => {
  const key = nameKey(input.name)
  return rows.filter(
    (r) =>
      r.documentId !== exceptId &&
      r.date === input.date &&
      ((key !== '' && nameKey(r.name) === key) || (input.sum > 0 && r.sum === input.sum)),
  )
}
