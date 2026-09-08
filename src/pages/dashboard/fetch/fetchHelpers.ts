/* eslint-disable @typescript-eslint/no-explicit-any */
import { strapiQuery } from '../../../lib/strapiQuery'

import { Axios } from '../../../lib/api'

// Потолок страницы = `api.rest.maxLimit` в strapi/config/api.ts. Просить больше
// бессмысленно: сервер молча урежет ответ до 500, и часть денег потеряется без
// единой ошибки в консоли.
export const PAGE_SIZE = 500

// Забрать ВСЕ страницы выборки.
//
// 🟥 Зачем цикл, а не «попросить побольше»: интерсептор в lib/api.ts возвращает
// `response.data.data`, то есть `meta.pagination` до вызывающего кода не доходит
// и посчитать число страниц нельзя. Поэтому признак конца — короткая страница.
// Ровно этот пробел и породил `pageSize: 40` на расходах: 41-я строка молча
// выпадала из «Результата месяца» (на проде расходы уже доходили до 35 в месяц).
export const fetchAllPages = async <T>(
  endpoint: string,
  buildPageQuery: (page: number) => string,
  maxPages = 40,
): Promise<T[]> => {
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const rows = await Axios.get<T[]>(`${endpoint}?${buildPageQuery(page)}`)
    const arr = Array.isArray(rows) ? (rows as T[]) : []
    out.push(...arr)
    if (arr.length < PAGE_SIZE) return out
    if (page === maxPages) {
      // предохранитель: лучше шумная ошибка, чем тихо срезанные деньги
      console.error(
        `fetchAllPages: ${endpoint} отдал ${maxPages} полных страниц — выборка обрезана`,
      )
    }
  }
  return out
}

export const buildQuery = (
  filters: Record<string, any>,
  fields: string[],
  populate?: Record<string, any>,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: PAGE_SIZE },
) => {
  return strapiQuery(
    {
      filters,
      fields,
      populate,
      pagination,
    },
  )
}

const buildQueryCost = (
  fields: string[],
  dateField: string,
  firstDay: Date,
  lastDay: Date,
  page = 1,
) =>
  strapiQuery(
    {
      filters: {
        [dateField]: {
          $gte: firstDay.toISOString(),
          $lte: lastDay.toISOString(),
        },
      },
      fields,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
      },
    },
  )

// Все записи коллекции за период (деньги месяца) — с пагинацией.
export const fetchAllCost = <T>(
  endpoint: string,
  fields: string[],
  dateField: string,
  firstDay: Date,
  lastDay: Date,
): Promise<T[]> =>
  fetchAllPages<T>(endpoint, (page) => buildQueryCost(fields, dateField, firstDay, lastDay, page))

export const fetchData = async <T>(endpoint: string, query: string): Promise<T[]> => {
  return await Axios.get(`${endpoint}?${query}`)
}

// Fetch a single day's DRAFT records of a collection — used to preview a shift close
// (drafts aren't counted by the published-only monthly fetches until they're published).
// dateField 'start' → datetime range, otherwise an exact-day match on a `date` field.
export const fetchDayDrafts = async <T>(
  endpoint: string,
  fields: string[],
  dateField: 'date' | 'start',
  dateStr: string,
  populate?: Record<string, any>,
): Promise<T[]> => {
  const filters =
    dateField === 'start'
      ? { start: { $gte: `${dateStr}T00:00:00.000Z`, $lte: `${dateStr}T23:59:59.999Z` } }
      : { date: { $eq: dateStr } }
  const query = strapiQuery(
    { filters, fields, populate, pagination: { page: 1, pageSize: 200 }, status: 'draft' },
  )
  return await Axios.get(`${endpoint}?${query}`)
}

export interface PersonalSumData {
  sum: string
  date?: string // есть у work-times (fields включает 'date') — нужна для по-сменного расчёта ставки
  personal: {
    name: string
    rates?: any
    excessThreshold?: number
  }
}

export const summarizeGeneric = (
  base: Map<string, any>,
  data: PersonalSumData[],
  field: keyof any,
  excludeNames: string[] = [],
) => {
  for (const item of data) {
    const name = item.personal?.name
    if (!name || !base.has(name) || excludeNames.includes(name)) continue
    const sum = Number.parseFloat(item.sum || '0')
    base.get(name)![field] += sum
  }
}

// YYYY-MM-DD по ЛОКАЛЬНЫМ компонентам даты: `toISOString` считает в UTC и у
// полуночи по Праге отдаёт вчерашний день (ключи графика разъезжались бы с
// датами записей).
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface Entry {
  date: string
  salonSalaries: string
  staffSalaries: string
  tip: string | null
}

export interface GroupedSum {
  date: string
  sum: number
}

export function groupAndSumByDateWithGaps(data: Entry[]): GroupedSum[] {
  const map = new Map<string, number>()

  data.forEach(({ date, salonSalaries, staffSalaries, tip }) => {
    const total = Number(salonSalaries) + Number(staffSalaries) + (tip ? Number(tip) : 0)

    map.set(date, (map.get(date) || 0) + total)
  })

  const dates = Array.from(map.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  if (dates.length === 0) return []

  // 🟥 Разбор и форматирование должны быть в ОДНОЙ шкале времени, иначе ключи
  // графика разъедутся с ключами map. `new Date('2026-09-01')` — это полночь
  // UTC, а `formatDate` теперь читает локальные компоненты; поэтому дату
  // собираем локальным конструктором.
  const localDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }

  const result: GroupedSum[] = []
  const currentDate = localDate(dates[0])
  const endDate = localDate(dates[dates.length - 1])
  endDate.setHours(23, 59, 59, 999)

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate)
    result.push({
      date: dateStr,
      sum: map.get(dateStr) ?? 0,
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

export interface InputItemReservation {
  ends_at: string
}

export interface OutputMetrictsItem {
  date: string
  [key: string]: number | string
}

export function groupCountReservationByDate(
  datasets: Record<string, InputItemReservation[]>,
): OutputMetrictsItem[] {
  const result: Record<string, any> = {}

  // проходим по каждому массиву
  Object.entries(datasets).forEach(([key, data]) => {
    data.forEach((item) => {
      const d = new Date(item.ends_at)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const formatted = `${day}.${month}`

      if (!result[formatted]) {
        result[formatted] = { date: formatted }
      }
      result[formatted][`count${key}`] = (result[formatted][`count${key}`] ?? 0) + 1
    })
  })

  // берём любую дату как базу (первый массив)
  const allItems = Object.values(datasets).flat()
  const baseDate = allItems.length ? new Date(allItems[0].ends_at) : new Date()
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // создаём полный месяц
  const fullMonth: OutputMetrictsItem[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const d = String(day).padStart(2, '0')
    const m = String(month + 1).padStart(2, '0')
    const formatted = `${d}.${m}`

    fullMonth.push({
      date: formatted,
      ...result[formatted],
      ...Object.keys(datasets).reduce(
        (acc, key) => ({ ...acc, [`count${key}`]: result[formatted]?.[`count${key}`] ?? 0 }),
        {},
      ),
    })
  }

  return fullMonth
}
