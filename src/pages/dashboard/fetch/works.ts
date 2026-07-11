import { getMonthRange } from '../../../utils/getMonthRange'
import { fetchMirrorBookingsRange } from '../../../lib/mirror'

import { buildQuery, fetchData, groupCountReservationByDate, type InputItemReservation } from './fetchHelpers'

export interface IDataWorks {
  name: string
  noonaEmployeeId?: string
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

interface ChartDataItem {
  date: string
  countPayed: number
  countCanceled: number
  countNoshow: number
}

export const getWorks = async (name: string, month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const filtersOffers = {
    name: { $eq: name },
  }

  const offersQuery = buildQuery(filtersOffers, ['name', 'noonaEmployeeId'], {
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

  const result = salary + extraProfit + tipSum - payrolls - penalty

  // График броней мастера — из НАШЕЙ БД (booking по noonaEmployeeId), фаза 4
  let chartData: ChartDataItem[] = []
  const noonaEmployeeId = data[0]?.noonaEmployeeId

  if (noonaEmployeeId) {
    try {
      const dayStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const bookings = await fetchMirrorBookingsRange(
        dayStr(firstDay),
        dayStr(lastDay),
        `&filters[noonaEmployeeId][$eq]=${noonaEmployeeId}`,
      )
      const toMetric = (status: 'other' | 'cancelled' | 'noshow'): InputItemReservation[] =>
        bookings
          .filter((b) =>
            status === 'other' ? b.status !== 'cancelled' && b.status !== 'noshow' : b.status === status,
          )
          .filter((b) => b.endsAt)
          .map((b) => ({ ends_at: b.endsAt as string }))

      chartData = groupCountReservationByDate({
        Payed: toMetric('other'),
        Canceled: toMetric('cancelled'),
        Noshow: toMetric('noshow'),
      }) as unknown as ChartDataItem[]
    } catch (error) {
      console.error('Error fetching bookings for master chart:', error)
    }
  }

  return {
    works: data[0],
    salary,
    extraProfit,
    payrolls,
    penalty,
    result,
    tipSum,
    chartData,
  }
}
