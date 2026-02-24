import { getMonthRange } from '../../../utils/getMonthRange'
import { NoonaHQ } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

import { buildQuery, fetchData, groupCountReservationByDate, type InputItemReservation } from './fetchHelpers'
import { splitEventsByStatus, groupByColor } from './getEvents'

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

  // Получаем данные для графика из Noona API если есть noonaEmployeeId
  let chartData: ChartDataItem[] = []
  const noonaEmployeeId = data[0]?.noonaEmployeeId

  if (noonaEmployeeId) {
    try {
      const queryString = new URLSearchParams()
      const queryParams: Record<string, string | string[]> = {
        select: ['id', 'event_types.color', 'customer_name', 'status', 'ends_at'],
        filter: JSON.stringify({
          from: firstDay.toISOString(),
          to: lastDay.toISOString(),
          employee_id: noonaEmployeeId,
        }),
      }

      Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((val) => queryString.append(key, val))
        } else {
          queryString.append(key, String(value))
        }
      })

      const eventsResponse = await NoonaHQ.get(`/${COMPANY_ID}/events?${queryString.toString()}`)
      const { cancelled, noshow, others } = splitEventsByStatus(eventsResponse.data)
      const groupedByColor = groupByColor(others)

      chartData = groupCountReservationByDate({
        Payed: (groupedByColor['#FF787D'] || []) as InputItemReservation[],
        Canceled: cancelled as InputItemReservation[],
        Noshow: noshow as InputItemReservation[],
      }) as unknown as ChartDataItem[]
    } catch (error) {
      console.error('Error fetching Noona events for master:', error)
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
