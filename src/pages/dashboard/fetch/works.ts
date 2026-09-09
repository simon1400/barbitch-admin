import { ymd } from '../../../utils/date'
import { getMonthRange } from '../../../utils/getMonthRange'
import { engineCalendarWeek } from '../../calendar/fetch/engineApi'

import {
  buildQuery,
  fetchAllPages,
  fetchData,
  groupCountReservationByDate,
  type InputItemReservation,
  PAGE_SIZE,
} from './fetchHelpers'
import { isAttendedStatus } from '../../../lib/bookingStatus'

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

export interface IExtraProfitItem {
  id: number
  sum: string
  date: string
  title: string
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

  const penaltyQuery = (page: number) =>
    buildQuery(penaltyFilters, ['sum'], undefined, { page, pageSize: PAGE_SIZE })
  // Премии — с датой и названием, чтобы показать таблицу расшифровки (как у администраторов)
  const extraQuery = (page: number) =>
    buildQuery(penaltyFilters, ['sum', 'date', 'title'], undefined, { page, pageSize: PAGE_SIZE })

  // personals остаётся одиночным запросом: это ОДИН мастер по имени, а его
  // услуги приходят вложенным populate — он не режется постраничностью
  // (проверено на проде: 67 услуг за месяц приходят полностью).
  const [data, penalties, extra, payroll] = await Promise.all([
    fetchData<IDataWorks>('/api/personals', offersQuery),
    fetchAllPages<IDataSumOnly>('/api/penalties', penaltyQuery),
    fetchAllPages<IExtraProfitItem>('/api/add-moneys', extraQuery),
    fetchAllPages<IDataSumOnly>('/api/payrolls', penaltyQuery),
  ])

  const penalty = penalties.reduce((acc, item) => acc + +item.sum, 0)
  const extraProfit = extra.reduce((acc, item) => acc + +item.sum, 0)
  const payrolls = payroll.reduce((acc, item) => acc + +item.sum, 0)

  const extraProfits = [...extra].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

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
      // 🟥 Не `/api/bookings`: с s182 эта коллекция закрыта для роли master (403),
      // и график «Moje rezervace» у мастеров молча оставался ПУСТЫМ — ошибка
      // только в консоли. Поймано при проверке в браузере (s183).
      // Ручка движка мастеру разрешена и сама подставляет ЕГО id, чужие брони
      // получить нельзя; диапазон произвольный, поэтому месяц берём одним запросом.
      const bookings = (await engineCalendarWeek(
        ymd(firstDay),
        ymd(lastDay),
        noonaEmployeeId,
      )) as { status?: string; endsAt?: string | null }[]
      const toMetric = (status: 'other' | 'cancelled' | 'noshow'): InputItemReservation[] =>
        bookings
          .filter((b) =>
            status === 'other' ? isAttendedStatus(b.status ?? '') : b.status === status,
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
    extraProfits,
    payrolls,
    penalty,
    result,
    tipSum,
    chartData,
  }
}
