import type { PersonalSumData } from './fetchHelpers'

import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData, groupAndSumByDateWithGaps, summarizeGeneric } from './fetchHelpers'

interface IDataAllWorks extends PersonalSumData {
  staffSalaries: string
  salonSalaries: string
  tip: string
  date: string
  excessThreshold?: number
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
  excessThreshold: number
}

export interface IFilteredData {
  summary: Result[]
  globalFlow: number
  sumMasters: number
  sumClientsDone: number
}

function summarizeWorks(
  data: IDataAllWorks[],
  penalties: PersonalSumData[],
  extras: PersonalSumData[],
  payrolls: PersonalSumData[],
  advance: PersonalSumData[],
  salaries: PersonalSumData[],
): IFilteredData {
  const resultMap = new Map<string, Result>()
  let globalFlow = 0
  let sumMasters = 0
  let sumClientsDone = 0

  data.forEach((item) => {
    const name = item.personal?.name
    if (!name) return

    const staff = Number.parseFloat(item.staffSalaries || '0')
    const salon = Number.parseFloat(item.salonSalaries || '0')
    const tip = Number.parseFloat(item.tip || '0')

    globalFlow += staff + salon + tip

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
        excessThreshold: item.personal?.excessThreshold ?? 0,
      })
    }

    const res = resultMap.get(name)!
    res.sum += staff
    res.sumTip += tip
    res.countClient += 1
  })

  summarizeGeneric(resultMap, penalties, 'penalty')
  summarizeGeneric(resultMap, extras, 'extraProfit')
  summarizeGeneric(resultMap, payrolls, 'payrolls')
  summarizeGeneric(resultMap, advance, 'advance')
  summarizeGeneric(resultMap, salaries, 'salaries')

  const summary = Array.from(resultMap.values())

  summary.forEach((item) => {
    sumMasters += item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
    sumClientsDone += item.countClient
  })

  return { summary, globalFlow, sumMasters, sumClientsDone }
}

export const getAllWorks = async (month: number) => {
  const { firstDay, lastDay } = getMonthRange(2025, month)

  const filters = { date: { $gte: firstDay.toISOString(), $lte: lastDay.toISOString() } }

  const serviceQuery = buildQuery(filters, ['staffSalaries', 'salonSalaries', 'tip', 'date'], {
    personal: { fields: ['name', 'excessThreshold'] },
  })

  const genericQuery = buildQuery(filters, ['sum'], { personal: { fields: ['name'] } })

  const [data, penalties, extras, payrolls, advance, salaries] = await Promise.all([
    fetchData<IDataAllWorks>('/api/services-provided', serviceQuery),
    fetchData<PersonalSumData>('/api/penalties', genericQuery),
    fetchData<PersonalSumData>('/api/add-moneys', genericQuery),
    fetchData<PersonalSumData>('/api/payrolls', genericQuery),
    fetchData<PersonalSumData>('/api/avanses', genericQuery),
    fetchData<PersonalSumData>('/api/salaries', genericQuery),
  ])

  const filteredData = summarizeWorks(data, penalties, extras, payrolls, advance, salaries)

  return {
    summary: filteredData.summary.sort((a, b) => b.sum - a.sum),
    globalFlow: filteredData.globalFlow,
    sumMasters: filteredData.sumMasters,
    sumClientsDone: filteredData.sumClientsDone,
    daysResult: groupAndSumByDateWithGaps(data),
  }
}
