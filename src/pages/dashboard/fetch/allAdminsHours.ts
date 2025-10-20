import type { PersonalSumData } from './fetchHelpers'

import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData, summarizeGeneric } from './fetchHelpers'

interface RateItem {
  rate: number | string
  from?: string | null
  to?: string | null
}

const MAX_DATE = new Date(8640000000000000) // бесконечная дата

function getRateForMonth(
  rates: RateItem[] | undefined,
  monthStart: Date,
  monthEnd: Date,
): number | null {
  if (!rates || !rates.length) return null

  const found = rates.find((r) => {
    const from = r.from ? new Date(r.from) : new Date(0)
    const to = r.to ? new Date(r.to) : MAX_DATE
    return from <= monthEnd && to >= monthStart
  })

  const val = found?.rate
  const num = typeof val === 'string' ? Number(val) : val
  return Number.isFinite(num as number) ? (num as number) : null
}

export interface ResultAdmins {
  name: string
  sum: number
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  rate?: any
}

export interface IFilteredAdminsData {
  summary: ResultAdmins[]
  sumAdmins: number
}

function summarizeAdmins(
  data: PersonalSumData[],
  penalty: PersonalSumData[],
  extra: PersonalSumData[],
  payrolls: PersonalSumData[],
  advance: PersonalSumData[],
  salaries: PersonalSumData[],
  monthStart: Date,
  monthEnd: Date,
): IFilteredAdminsData {
  const resultMap = new Map<string, ResultAdmins>()
  let sumAdmins = 0

  data.forEach(({ sum, personal }) => {
    const name = personal?.name
    if (!name) return
    const hours = Number.parseFloat(sum || '0')
    if (!resultMap.has(name)) {
      const rate =
        getRateForMonth(personal?.rates as unknown as RateItem[], monthStart, monthEnd) ?? 115
      resultMap.set(name, {
        name,
        sum: 0,
        penalty: 0,
        extraProfit: 0,
        payrolls: 0,
        advance: 0,
        salaries: 0,
        rate,
      })
    }
    resultMap.get(name)!.sum += hours
  })

  summarizeGeneric(resultMap, penalty, 'penalty', ['Mariia Medvedeva'])
  summarizeGeneric(resultMap, extra, 'extraProfit', ['Mariia Medvedeva'])
  summarizeGeneric(resultMap, payrolls, 'payrolls')
  summarizeGeneric(resultMap, advance, 'advance')
  summarizeGeneric(resultMap, salaries, 'salaries')

  const summary = Array.from(resultMap.values())
  summary.forEach((item) => {
    const rate = item.rate ?? 115
    sumAdmins += item.sum * rate + item.extraProfit - item.penalty - item.payrolls
  })

  return { summary, sumAdmins }
}

export const getAdminsHours = async (month: number) => {
  const { firstDay, lastDay } = getMonthRange(2025, month)

  const filters = {
    date: { $gte: firstDay.toISOString(), $lte: lastDay.toISOString() },
  }

  const queryWorkTimes = buildQuery(
    { start: filters.date },
    ['start', 'sum'],
    {
      personal: {
        fields: ['name'],
        populate: { rates: { fields: ['rate', 'from', 'to', 'typeWork'] } },
      },
    },
    { page: 1, pageSize: 70 },
  )

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries] = await Promise.all([
    fetchData<PersonalSumData>('/api/work-times', queryWorkTimes),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
  ])

  const { summary, sumAdmins } = summarizeAdmins(
    data,
    penalties,
    extras,
    payrolls,
    advance,
    salaries,
    firstDay,
    lastDay,
  )

  return {
    summary: summary.sort((a, b) => b.sum - a.sum),
    sumAdmins,
  }
}
