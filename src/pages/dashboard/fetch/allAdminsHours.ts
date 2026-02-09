/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PersonalSumData } from './fetchHelpers'

import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData, summarizeGeneric } from './fetchHelpers'

interface RateItem {
  rate: number | string
  hourlyRate?: number | string | null
  from?: string | null
  to?: string | null
  typeWork?: string | null
}

interface RateInfo {
  rate: number // Почасовая ставка (или hourlyRate для HPP)
  fixedMonthlyRate: number | null // Фиксированная месячная зарплата (только для HPP)
  isFixedMonthly: boolean // true если HPP (фиксированная месячная зарплата)
}

const MAX_DATE = new Date(8640000000000000) // бесконечная дата

function getRateInfoForMonth(
  rates: RateItem[] | undefined,
  monthStart: Date,
  monthEnd: Date,
): RateInfo {
  if (!rates || !rates.length) return { rate: 115, fixedMonthlyRate: null, isFixedMonthly: false }

  const found = rates.find((r) => {
    const from = r.from ? new Date(r.from) : new Date(0)
    const to = r.to ? new Date(r.to) : MAX_DATE
    return from <= monthEnd && to >= monthStart
  })

  if (!found) return { rate: 115, fixedMonthlyRate: null, isFixedMonthly: false }

  const isFixedMonthly = found.typeWork === 'hpp'

  // Для HPP: rate - фиксированная месячная, hourlyRate - почасовая
  // Для DPP: rate - почасовая
  const rateVal = found.rate
  const rateNum = typeof rateVal === 'string' ? Number(rateVal) : rateVal
  const mainRate = Number.isFinite(rateNum as number) ? (rateNum as number) : 115

  if (isFixedMonthly) {
    // HPP: используем hourlyRate как почасовую ставку, rate как фиксированную месячную
    const hourlyVal = found.hourlyRate
    const hourlyNum = typeof hourlyVal === 'string' ? Number(hourlyVal) : hourlyVal
    const hourlyRate = Number.isFinite(hourlyNum as number) ? (hourlyNum as number) : 115

    return { rate: hourlyRate, fixedMonthlyRate: mainRate, isFixedMonthly: true }
  }

  // DPP: rate - почасовая ставка
  return { rate: mainRate, fixedMonthlyRate: null, isFixedMonthly: false }
}

export interface ResultAdmins {
  name: string
  sum: number
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
  rate: number // Почасовая ставка
  fixedMonthlyRate: number | null // Фиксированная месячная зарплата (только для HPP)
  isFixedMonthly: boolean
  excessThreshold: number
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
  taxes: PersonalSumData[],
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
      const rateInfo = getRateInfoForMonth(personal?.rates as unknown as RateItem[], monthStart, monthEnd)
      resultMap.set(name, {
        name,
        sum: 0,
        penalty: 0,
        extraProfit: 0,
        payrolls: 0,
        advance: 0,
        salaries: 0,
        taxes: 0,
        rate: rateInfo.rate,
        fixedMonthlyRate: rateInfo.fixedMonthlyRate,
        isFixedMonthly: rateInfo.isFixedMonthly,
        excessThreshold: personal?.excessThreshold ?? 0,
      })
    }
    resultMap.get(name)!.sum += hours
  })

  summarizeGeneric(resultMap, penalty, 'penalty', ['Mariia Medvedeva'])
  summarizeGeneric(resultMap, extra, 'extraProfit', ['Mariia Medvedeva'])
  summarizeGeneric(resultMap, payrolls, 'payrolls')
  summarizeGeneric(resultMap, advance, 'advance')
  summarizeGeneric(resultMap, salaries, 'salaries')
  summarizeGeneric(resultMap, taxes, 'taxes')

  const summary = Array.from(resultMap.values())
  summary.forEach((item) => {
    let contribution: number
    if (item.isFixedMonthly && item.fixedMonthlyRate !== null) {
      // HPP - фиксированная месячная зарплата
      // fixedMonthlyRate - месячная зарплата, rate - почасовая (для других расчётов)
      contribution = item.fixedMonthlyRate + item.extraProfit - item.penalty - item.payrolls
    } else {
      // DPP - почасовая оплата
      contribution = item.sum * item.rate + item.extraProfit - item.penalty - item.payrolls
    }
    sumAdmins += contribution
  })

  return { summary, sumAdmins }
}

export const getAdminsHours = async (month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const filters = {
    date: { $gte: firstDay.toISOString(), $lte: lastDay.toISOString() },
  }

  const queryWorkTimes = buildQuery(
    { start: filters.date },
    ['start', 'sum'],
    {
      personal: {
        fields: ['name', 'excessThreshold'],
        populate: { rates: { fields: ['rate', 'hourlyRate', 'from', 'to', 'typeWork'] } },
      },
    },
    { page: 1, pageSize: 70 },
  )

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries, taxes] = await Promise.all([
    fetchData<PersonalSumData>('/api/work-times', queryWorkTimes),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
    fetchData<PersonalSumData>('/api/taxes', genericQuery),
  ])

  const { summary, sumAdmins } = summarizeAdmins(
    data,
    penalties,
    extras,
    payrolls,
    advance,
    salaries,
    taxes,
    firstDay,
    lastDay,
  )

  return {
    summary: summary.sort((a, b) => b.sum - a.sum),
    sumAdmins,
  }
}

export const getAdminsHoursByDateRange = async (startDate: Date, endDate: Date) => {
  const filters = {
    date: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
  }

  const queryWorkTimes = buildQuery(
    { start: filters.date },
    ['start', 'sum'],
    {
      personal: {
        fields: ['name', 'excessThreshold'],
        populate: { rates: { fields: ['rate', 'hourlyRate', 'from', 'to', 'typeWork'] } },
      },
    },
    { page: 1, pageSize: 70 },
  )

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries, taxes] = await Promise.all([
    fetchData<PersonalSumData>('/api/work-times', queryWorkTimes),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
    fetchData<PersonalSumData>('/api/taxes', genericQuery),
  ])

  const { summary, sumAdmins } = summarizeAdmins(
    data,
    penalties,
    extras,
    payrolls,
    advance,
    salaries,
    taxes,
    startDate,
    endDate,
  )

  return {
    summary: summary.sort((a, b) => b.sum - a.sum),
    sumAdmins,
  }
}
