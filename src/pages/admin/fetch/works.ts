import { getMonthRange } from '../../../utils/getMonthRange'

import { buildQuery, fetchData } from './fetchHelpers'

export interface IDataWorks {
  name: string
  offersDone: {
    id: number
    date: string
    clientName: string
    staffSalaries: string
    tip: string
  }[]
}

interface IDataSumOnly {
  sum: string
}

export const getWorks = async (name: string, month: number) => {
  const { firstDay, lastDay } = getMonthRange(2025, month)

  const filtersOffers = {
    name: { $eq: name },
  }

  const offersQuery = buildQuery(filtersOffers, ['name'], {
    offersDone: {
      sort: ['date:desc'],
      filters: {
        date: {
          $gte: firstDay.toISOString(),
          $lte: lastDay.toISOString(),
        },
      },
      fields: ['date', 'clientName', 'staffSalaries', 'tip'],
    },
  })

  const penaltyFilters = {
    personal: { name: { $eq: name } },
    date: {
      $gte: firstDay.toISOString(),
      $lte: lastDay.toISOString(),
    },
  }

  const penaltyQuery = buildQuery(penaltyFilters, ['sum'])

  const [data, penalties, extra, payroll] = await Promise.all([
    fetchData<IDataWorks>('/api/personals', offersQuery),
    fetchData<IDataSumOnly>('/api/penalties', penaltyQuery),
    fetchData<IDataSumOnly>('/api/add-moneys', penaltyQuery),
    fetchData<IDataSumOnly>('/api/payrolls', penaltyQuery),
  ])

  const penalty = penalties.reduce((acc, item) => acc + +item.sum, 0)
  const extraProfit = extra.reduce((acc, item) => acc + +item.sum, 0)
  const payrolls = payroll.reduce((acc, item) => acc + +item.sum, 0)

  const offers = data[0]?.offersDone || []

  let tipSum = 0

  const salary = offers.reduce((acc, offer) => {
    const salary = +offer.staffSalaries || 0
    const tip = +offer.tip || 0
    tipSum += tip
    return acc + salary
  }, 0)

  const result = salary + extraProfit - payrolls - penalty

  return {
    works: data[0],
    salary,
    extraProfit,
    payrolls,
    penalty,
    result,
    tipSum,
  }
}
