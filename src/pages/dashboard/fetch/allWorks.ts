import type { PersonalSumData } from './fetchHelpers'

import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData, groupAndSumByDateWithGaps, summarizeGeneric } from './fetchHelpers'

interface IDataAllWorks extends PersonalSumData {
  staffSalaries: string
  salonSalaries: string
  tip: string
  date: string
  excessThreshold?: number
  cash: boolean
}

interface Result {
  name: string
  sum: number
  sumTip: number
  countClient: number
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
  excessThreshold: number
}

export interface IFilteredData {
  summary: Result[]
  globalFlow: number
  sumMasters: number
  sumClientsDone: number
  averageCheck: number
  averageMasterSalary: number
  salonSalariesCash: number
  salonSalariesCard: number
}

function summarizeWorks(
  data: IDataAllWorks[],
  penalties: PersonalSumData[],
  extras: PersonalSumData[],
  payrolls: PersonalSumData[],
  advance: PersonalSumData[],
  salaries: PersonalSumData[],
  taxes: PersonalSumData[],
): IFilteredData {
  const resultMap = new Map<string, Result>()
  let globalFlow = 0
  let sumMasters = 0
  let sumClientsDone = 0
  let totalStaffSalaries = 0
  let salonSalariesCash = 0
  let salonSalariesCard = 0

  data.forEach((item) => {
    const name = item.personal?.name
    if (!name) return

    const staff = Number.parseFloat(item.staffSalaries || '0')
    const salon = Number.parseFloat(item.salonSalaries || '0')
    const tip = Number.parseFloat(item.tip || '0')

    globalFlow += staff + salon + tip
    totalStaffSalaries += staff

    if (item.cash) {
      salonSalariesCash += salon
    } else {
      salonSalariesCard += salon - ((salon + staff + tip) * 0.21)
    }

    if (!resultMap.has(name)) {
      resultMap.set(name, {
        name,
        sum: 0,
        sumTip: 0,
        countClient: 0,
        penalty: 0,
        extraProfit: 0,
        payrolls: 0,
        advance: 0,
        salaries: 0,
        taxes: 0,
        excessThreshold: item.personal?.excessThreshold ?? 0,
      })
    }

    const res = resultMap.get(name)!
    res.sum += staff
    res.sumTip += tip
    res.countClient += 1
  })

  // Исключаем Oleksandra Fishchuk из штрафов/премий/списываний в таблице мастеров,
  // так как она основной администратор и эти данные должны быть только в таблице администраторов
  const excludeFromMasters = ['Oleksandra Fishchuk']

  summarizeGeneric(resultMap, penalties, 'penalty', excludeFromMasters)
  summarizeGeneric(resultMap, extras, 'extraProfit', excludeFromMasters)
  summarizeGeneric(resultMap, payrolls, 'payrolls', excludeFromMasters)
  summarizeGeneric(resultMap, advance, 'advance', excludeFromMasters)
  summarizeGeneric(resultMap, salaries, 'salaries', excludeFromMasters)
  summarizeGeneric(resultMap, taxes, 'taxes')

  const summary = Array.from(resultMap.values())

  summary.forEach((item) => {
    sumMasters += item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
    sumClientsDone += item.countClient
  })

  const averageCheck = sumClientsDone > 0 ? Math.round(globalFlow / sumClientsDone) : 0
  const averageMasterSalary = sumClientsDone > 0 ? Math.round(totalStaffSalaries / sumClientsDone) : 0

  return { summary, globalFlow, sumMasters, sumClientsDone, averageCheck, averageMasterSalary, salonSalariesCash, salonSalariesCard }
}

export const getAllWorks = async (month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const filters = { date: { $gte: firstDay.toISOString(), $lte: lastDay.toISOString() } }

  const serviceQuery = buildQuery(filters, ['staffSalaries', 'salonSalaries', 'tip', 'date', 'cash'], {
    personal: { fields: ['name', 'excessThreshold'] },
  })

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries, taxes] = await Promise.all([
    fetchData<IDataAllWorks>('/api/services-provided', serviceQuery),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
    fetchData<PersonalSumData>('/api/taxes', genericQuery),
  ])

  const filteredData = summarizeWorks(data, penalties, extras, payrolls, advance, salaries, taxes)

  return {
    summary: filteredData.summary.sort((a, b) => b.sum - a.sum),
    globalFlow: filteredData.globalFlow,
    sumMasters: filteredData.sumMasters,
    sumClientsDone: filteredData.sumClientsDone,
    averageCheck: filteredData.averageCheck,
    averageMasterSalary: filteredData.averageMasterSalary,
    salonSalariesCash: filteredData.salonSalariesCash,
    salonSalariesCard: filteredData.salonSalariesCard,
    daysResult: groupAndSumByDateWithGaps(data),
  }
}

export const getAllWorksByDateRange = async (startDate: Date, endDate: Date) => {
  const filters = { date: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } }

  const serviceQuery = buildQuery(filters, ['staffSalaries', 'salonSalaries', 'tip', 'date', 'cash'], {
    personal: { fields: ['name', 'excessThreshold'] },
  })

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries, taxes] = await Promise.all([
    fetchData<IDataAllWorks>('/api/services-provided', serviceQuery),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
    fetchData<PersonalSumData>('/api/taxes', genericQuery),
  ])

  const filteredData = summarizeWorks(data, penalties, extras, payrolls, advance, salaries, taxes)

  return {
    summary: filteredData.summary.sort((a, b) => b.sum - a.sum),
    globalFlow: filteredData.globalFlow,
    sumMasters: filteredData.sumMasters,
    sumClientsDone: filteredData.sumClientsDone,
    averageCheck: filteredData.averageCheck,
    averageMasterSalary: filteredData.averageMasterSalary,
    salonSalariesCash: filteredData.salonSalariesCash,
    salonSalariesCard: filteredData.salonSalariesCard,
    daysResult: groupAndSumByDateWithGaps(data),
  }
}
