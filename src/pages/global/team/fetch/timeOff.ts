// Отпуска / больничные. Чтение — REST `/api/time-offs` (сессия сотрудника),
// запись — только ручка движка `/engine/admin/time-offs` (руководство, s216):
// она же ставит мастеру серию блоков в календаре на эти дни и пишет журнал.
import { Axios } from '../../../../lib/api'
import { makeApiFetch } from '../../../../lib/apiFetch'

export type TimeOffType = 'sick' | 'vacation' | 'personal'

export interface TimeOffRecord {
  documentId: string
  type: TimeOffType
  startDate: string
  endDate: string
  paid: boolean
  comment: string | null
  personal: { documentId: string; name: string } | null
  /** серия блоков в календаре (own-ключ движка); null — блоков нет (не мастер или запись из CM) */
  blockSeriesKey: string | null
}

// Сырой ответ Strapi (только нужные поля)
interface RawTimeOff {
  documentId: string
  type: TimeOffType
  startDate: string
  endDate: string
  paid: boolean | null
  comment: string | null
  personal: { documentId: string; name: string } | null
  blockSeriesKey?: string | null
}

// Человекочитаемые подписи типов отсутствия
export const TYPE_LABELS: Record<TimeOffType, string> = {
  sick: 'Больничный',
  vacation: 'Отпуск',
  personal: 'Личный',
}

const pad = (n: number) => String(n).padStart(2, '0')

// Парсит 'YYYY-MM-DD' в UTC-миллисекунды (без сдвига часового пояса)
const parseDate = (d: string): number => {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

const DAY_MS = 86_400_000

// Кол-во дней записи, попавших ВНУТРЬ выбранного месяца (пересечение периода
// отсутствия с границами месяца). Обе границы ВКЛЮЧИТЕЛЬНО: 12.07–15.07 = 4 дня.
//
// ⚠️ Раньше считались только Пн–Пт. Для салона это неверно: он работает 7 дней в
// неделю, мастера и администраторы выходят по сменам в том числе в субботу и
// воскресенье — отпуск, начатый в воскресенье, терял день.
export const daysInMonth = (rec: TimeOffRecord, month: number, year: number): number => {
  const monthStart = Date.UTC(year, month, 1)
  const monthEnd = Date.UTC(year, month + 1, 0)
  const from = Math.max(parseDate(rec.startDate), monthStart)
  const to = Math.min(parseDate(rec.endDate), monthEnd)
  if (to < from) return 0

  return Math.round((to - from) / DAY_MS) + 1
}

// Все записи, чей период пересекается с выбранным месяцем
export const fetchTimeOffs = async (month: number, year: number): Promise<TimeOffRecord[]> => {
  const monthStartStr = `${year}-${pad(month + 1)}-01`
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const monthEndStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`

  // Пересечение: начало <= конца месяца И конец >= начала месяца
  const query =
    `/api/time-offs?` +
    `filters[startDate][$lte]=${monthEndStr}&` +
    `filters[endDate][$gte]=${monthStartStr}&` +
    `populate[personal][fields][0]=name&` +
    `pagination[pageSize]=300&sort=startDate:desc`

  const data: RawTimeOff[] = await Axios.get(query)

  return (data || []).map((item) => ({
    documentId: item.documentId,
    type: item.type,
    startDate: item.startDate,
    endDate: item.endDate,
    paid: item.paid ?? true,
    comment: item.comment || null,
    personal: item.personal
      ? { documentId: item.personal.documentId, name: item.personal.name }
      : null,
    blockSeriesKey: item.blockSeriesKey || null,
  }))
}

// ── запись (руководство) ────────────────────────────────────────────────────

export interface TimeOffInput {
  personal: string
  type: TimeOffType
  startDate: string
  endDate: string
  paid: boolean
  comment: string
}

/** Активная бронь мастера на дни отсутствия — блок её не отменяет, надо перенести. */
export interface TimeOffConflict {
  documentId: string
  date: string
  time: string | null
  client: string | null
  internal: boolean
}

export interface TimeOffSaveResult {
  row: TimeOffRecord
  /** сколько блоков у записи в календаре после сохранения (0 — не мастер) */
  blocks: number
  conflicts: TimeOffConflict[]
}

/** Одна запись — не длиннее квартала (сервер проверяет то же). */
export const MAX_SPAN_DAYS = 92

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Отпуска вносит только руководство салона.',
  unauthorized: 'Сессия истекла — войдите снова.',
  personal_required: 'Выберите сотрудника.',
  personal_not_found: 'Сотрудник не найден.',
  bad_type: 'Неизвестный тип отсутствия.',
  bad_date: 'Неверная дата.',
  bad_range: 'Конец раньше начала.',
  range_too_long: `Одна запись — не больше ${MAX_SPAN_DAYS} дней.`,
  date_too_far: 'Дата слишком далеко в будущем.',
  bad_paid: 'Оплачиваемость — да или нет.',
  comment_too_long: 'Комментарий слишком длинный (до 500 символов).',
  // timeoff_overlap — без подмены: сервер называет конкретный пересекающийся период
  timeoff_not_found: 'Запись уже удалена.',
}

const timeOffFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

export const createTimeOff = (input: TimeOffInput) =>
  timeOffFetch<TimeOffSaveResult>('POST', '/time-offs', input)

export const updateTimeOff = (documentId: string, input: TimeOffInput) =>
  timeOffFetch<TimeOffSaveResult>('PATCH', `/time-offs/${encodeURIComponent(documentId)}`, input)

export const deleteTimeOff = (documentId: string) =>
  timeOffFetch<{ deleted: string; blocks: number }>('DELETE', `/time-offs/${encodeURIComponent(documentId)}`)

export const fetchTimeOffConflicts = async (
  personal: string,
  startDate: string,
  endDate: string,
): Promise<TimeOffConflict[]> => {
  const q = new URLSearchParams({ personal, startDate, endDate }).toString()
  const res = await timeOffFetch<{ rows: TimeOffConflict[] }>('GET', `/time-offs/conflicts?${q}`)
  return Array.isArray(res?.rows) ? res.rows : []
}

/** Дней в периоде, обе границы включительно (как считает сервер). */
export const spanDays = (from: string, to: string): number =>
  Math.round((parseDate(to) - parseDate(from)) / DAY_MS) + 1

export interface EmployeeSummary {
  documentId: string
  name: string
  sick: number
  vacation: number
  personal: number
  total: number
  records: TimeOffRecord[]
}

// Группирует записи по сотруднику и считает дни по типам внутри месяца
export const buildSummaries = (
  records: TimeOffRecord[],
  month: number,
  year: number,
): EmployeeSummary[] => {
  const map = new Map<string, EmployeeSummary>()

  for (const rec of records) {
    const days = daysInMonth(rec, month, year)
    if (days === 0) continue
    const key = rec.personal?.documentId ?? '—'
    const name = rec.personal?.name ?? 'Bez zaměstnance'
    let entry = map.get(key)
    if (!entry) {
      entry = { documentId: key, name, sick: 0, vacation: 0, personal: 0, total: 0, records: [] }
      map.set(key, entry)
    }
    entry[rec.type] += days
    entry.total += days
    entry.records.push(rec)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
