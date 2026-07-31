import type { PersonalSumData } from './fetchHelpers'

import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData, fetchDayDrafts, summarizeGeneric } from './fetchHelpers'

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

const DEFAULT_RATE_INFO: RateInfo = { rate: 115, fixedMonthlyRate: null, isFixedMonthly: false }

function toRateInfo(found: RateItem | undefined): RateInfo {
  if (!found) return DEFAULT_RATE_INFO

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

// Ставка, действующая НА КОНКРЕТНУЮ ДАТУ (а не «на месяц»). Ставка может смениться
// посреди месяца (у записи истории ставок появляется `to`, у новой — `from` с того же
// дня) — тогда часть смен месяца считается по старой ставке, часть по новой.
// Даты сравниваются строками "YYYY-MM-DD" (тип поля date) — без таймзонных сюрпризов.
// На граничный день (to старой == from новой) побеждает запись с более поздним from,
// т.е. НОВАЯ ставка действует уже с указанного дня.
export function rateInfoForDate(rates: RateItem[] | undefined, dateStr: string): RateInfo {
  if (!rates || !rates.length) return DEFAULT_RATE_INFO

  const d = (dateStr || '').slice(0, 10)
  if (!d) return toRateInfo(rates[0])

  let found: RateItem | undefined
  let foundFrom = ''
  for (const r of rates) {
    const from = (r.from || '').slice(0, 10)
    const to = r.to ? r.to.slice(0, 10) : '9999-12-31'
    if (from <= d && d <= to && from >= foundFrom) {
      found = r
      foundFrom = from
    }
  }

  // Дыра в истории ставок (дата ни в один период не попала) —
  // берём последнюю ставку, начавшуюся ДО этой даты.
  if (!found) {
    for (const r of rates) {
      const from = (r.from || '').slice(0, 10)
      if (from <= d && from >= foundFrom) {
        found = r
        foundFrom = from
      }
    }
  }

  return toRateInfo(found ?? rates[0])
}

export interface ResultAdmins {
  name: string
  sum: number
  // Заработок за часы = Σ (часы смены × ставка, действующая в ДАТУ смены).
  // При смене ставки посреди месяца это НЕ равно sum × rate — использовать earned.
  earned: number
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
  rate: number // Почасовая ставка, действующая на конец периода (информационно)
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
  monthEnd: Date,
): IFilteredAdminsData {
  const resultMap = new Map<string, ResultAdmins>()
  let sumAdmins = 0
  const monthEndStr = monthEnd.toISOString().slice(0, 10)

  data.forEach((item) => {
    const { sum, personal } = item
    const name = personal?.name
    if (!name) return
    const hours = Number.parseFloat(sum || '0')
    const rates = personal?.rates as unknown as RateItem[]
    if (!resultMap.has(name)) {
      // «Текущая» ставка на конец периода — информационно (в деньгах не участвует).
      const rateInfo = rateInfoForDate(rates, monthEndStr)
      resultMap.set(name, {
        name,
        sum: 0,
        earned: 0,
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
    const entry = resultMap.get(name)!
    entry.sum += hours
    // Каждая смена оплачивается по ставке, действующей в ЕЁ дату — смена ставки
    // посреди месяца делит месяц корректно (часть по старой, часть по новой).
    entry.earned += hours * rateInfoForDate(rates, item.date || monthEndStr).rate
  })

  // Корректировки считаются для КАЖДОГО администратора полностью. Совместителей
  // (мастер+администратор) из таблицы администраторов убирает splitTeam (teamSplit.ts) —
  // для них есть отдельная таблица. Поэтому здесь больше нет исключений по именам.
  summarizeGeneric(resultMap, penalty, 'penalty')
  summarizeGeneric(resultMap, extra, 'extraProfit')
  summarizeGeneric(resultMap, payrolls, 'payrolls')
  summarizeGeneric(resultMap, advance, 'advance')
  summarizeGeneric(resultMap, salaries, 'salaries')
  summarizeGeneric(resultMap, taxes, 'taxes')

  const summary = Array.from(resultMap.values())
  // Администраторы ВСЕГДА получают почасовую оплату, независимо от типа
  // контракта (HPP/DPP). Поле typeWork хранит лишь тип договора (важно для
  // налогов/отчётности) и НЕ означает фиксированный месячный оклад. Формула
  // совпадает с расчётом строки «Результат» в Administrators.tsx, поэтому
  // итог «Общая сумма» и значения по строкам всегда сходятся.
  // earned (по-сменный расчёт) вместо sum × rate — иначе смена ставки посреди
  // месяца не отражалась бы (весь месяц считался по одной ставке).
  summary.forEach((item) => {
    sumAdmins += item.earned + item.extraProfit - item.penalty - item.payrolls
  })

  return { summary, sumAdmins }
}

export const getAdminsHours = async (month: number, year: number, previewDay?: string) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const filters = {
    date: { $gte: firstDay.toISOString(), $lte: lastDay.toISOString() },
  }

  const queryWorkTimes = buildQuery(
    { date: filters.date },
    ['date', 'sum'],
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

  // Preview: merge the day's draft work-times + payrolls (what a close publishes that
  // feeds admin pay). Rates come populated on the draft work-times just like the month.
  let wtData = data
  let payrollData = payrolls
  if (previewDay) {
    const [draftWt, draftPayrolls] = await Promise.all([
      fetchDayDrafts<PersonalSumData>('/api/work-times', ['date', 'sum'], 'date', previewDay, {
        personal: {
          fields: ['name', 'excessThreshold'],
          populate: { rates: { fields: ['rate', 'hourlyRate', 'from', 'to', 'typeWork'] } },
        },
      }),
      fetchDayDrafts<PersonalSumData>('/api/payrolls', ['sum'], 'date', previewDay, {
        personal: { fields: ['name'] },
      }),
    ])
    wtData = [...data, ...draftWt]
    payrollData = [...payrolls, ...draftPayrolls]
  }

  const { summary, sumAdmins } = summarizeAdmins(
    wtData,
    penalties,
    extras,
    payrollData,
    advance,
    salaries,
    taxes,
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
    { date: filters.date },
    ['date', 'sum'],
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
    endDate,
  )

  return {
    summary: summary.sort((a, b) => b.sum - a.sum),
    sumAdmins,
  }
}
