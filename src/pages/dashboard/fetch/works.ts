import { ymd } from '../../../utils/date'
import { getMonthRange } from '../../../utils/getMonthRange'
import { engineCalendarWeek, engineMyMonth } from '../../calendar/fetch/engineApi'

import { groupCountReservationByDate, type InputItemReservation } from './fetchHelpers'
import { isAttendedStatus } from '../../../lib/bookingStatus'

export interface IDataWorks {
  name: string
  noonaEmployeeId?: string | null
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

// Своя карточка, штрафы, доплаты, выплаты — одной ручкой движка (s229): «чья» решает
// сервер по связи учётки. Раньше это были четыре REST-запроса с фильтром по имени,
// который ставил браузер. Строки те же — расчёт ниже не менялся.
export const getWorks = async (month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const mine = await engineMyMonth(firstDay.toISOString(), lastDay.toISOString())
  const data: IDataWorks[] = mine.personal ? [mine.personal] : []
  const penalties: IDataSumOnly[] = mine.penalties
  const extra: IExtraProfitItem[] = mine.extra
  const payroll: IDataSumOnly[] = mine.payrolls

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
