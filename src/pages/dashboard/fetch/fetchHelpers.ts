/* eslint-disable @typescript-eslint/no-explicit-any */
import qs from 'qs'

import { Axios } from '../../../lib/api'

export const buildQuery = (
  filters: Record<string, any>,
  fields: string[],
  populate?: Record<string, any>,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 500 },
) => {
  return qs.stringify(
    {
      filters,
      fields,
      populate,
      pagination,
    },
    { encodeValuesOnly: true },
  )
}

export const buildQueryCost = (
  fields: string[],
  dateField: string,
  firstDay: Date,
  lastDay: Date,
) =>
  qs.stringify(
    {
      filters: {
        [dateField]: {
          $gte: firstDay.toISOString(),
          $lte: lastDay.toISOString(),
        },
      },
      fields,
      pagination: {
        page: 1,
        pageSize: 40,
      },
    },
    { encodeValuesOnly: true },
  )

export const fetchData = async <T>(endpoint: string, query: string): Promise<T[]> => {
  return await Axios.get(`${endpoint}?${query}`)
}

export interface PersonalSumData {
  sum: string
  personal: {
    name: string
    rates?: any
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
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

  const result: GroupedSum[] = []
  const currentDate = new Date(dates[0])
  const endDate = new Date(dates[dates.length - 1])
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
