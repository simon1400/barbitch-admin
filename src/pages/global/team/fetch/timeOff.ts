import { Axios } from '../../../../lib/api'

export type TimeOffType = 'sick' | 'vacation' | 'personal'

export interface TimeOffRecord {
  documentId: string
  type: TimeOffType
  startDate: string
  endDate: string
  paid: boolean
  comment: string | null
  personal: { documentId: string; name: string } | null
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

// Кол-во РАБОЧИХ дней (Пн–Пт) записи, попавших ВНУТРЬ выбранного месяца
// (пересечение периода отсутствия с границами месяца)
export const daysInMonth = (rec: TimeOffRecord, month: number, year: number): number => {
  const monthStart = Date.UTC(year, month, 1)
  const monthEnd = Date.UTC(year, month + 1, 0)
  const from = Math.max(parseDate(rec.startDate), monthStart)
  const to = Math.min(parseDate(rec.endDate), monthEnd)
  if (to < from) return 0

  let count = 0
  for (let t = from; t <= to; t += DAY_MS) {
    const dow = new Date(t).getUTCDay() // 0 = Вс, 6 = Сб
    if (dow !== 0 && dow !== 6) count++
  }
  return count
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
  }))
}

export interface EmployeeSummary {
  documentId: string
  name: string
  sick: number
  vacation: number
  personal: number
  total: number
  records: TimeOffRecord[]
}

// Группирует записи по сотруднику и считает рабочие дни по типам внутри месяца
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
