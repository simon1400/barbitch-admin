import type { InputItemReservation } from './fetchHelpers'

import { isBefore, isEqual, parseISO } from 'date-fns'
import { daysInMonth, todayDate, ymd } from '../../../utils/date'
import { getMonthRange } from '../../../utils/getMonthRange'
import { fetchMirrorBookingsRange, countBookingsCreatedBetween } from '../../../lib/mirror'
import type { MirrorBooking } from '../../../lib/mirror'

import { groupCountReservationByDate } from './fetchHelpers'

// Метрики резерваций месяца для дашборда/GlobalPage. own-booking фаза 4:
// источник — НАША БД (коллекция booking), Noona API не участвует.
// Маппинг против старой Noona-версии: цветовых категорий event_types (#FF787D
// «payed» / #822949 «fixed») в зеркале нет. s258: «fixed» (плитка «Коррекции») — брони с
// флагом `korekce`, который ставит движок бесплатной коррекции «Korekce do 5 dnů»
// (до s258 здесь стоял жёсткий 0); «payed» — все остальные брони кроме cancelled/noshow
// (коррекция бесплатна — в «платные» не идёт). Интерные брони (сотрудники) не считаются
// нигде, в том числе в «все».


export const getEvents = async (month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const today = todayDate()
  let day = today.getDate()
  if (today.getMonth() !== month || today.getFullYear() !== year) {
    day = daysInMonth(year, month)
  }

  const startToday = new Date(today)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(today)
  endToday.setHours(23, 59, 59, 999)

  const [bookings, countCreatedMonthReservation, countCreatedTodayReservation] = await Promise.all([
    fetchMirrorBookingsRange(ymd(firstDay), ymd(lastDay)),
    countBookingsCreatedBetween(firstDay.toISOString(), lastDay.toISOString()),
    countBookingsCreatedBetween(startToday.toISOString(), endToday.toISOString()),
  ])

  const cancelled: MirrorBooking[] = []
  const noshow: MirrorBooking[] = []
  const payed: MirrorBooking[] = []
  const korekce: MirrorBooking[] = []
  let all = 0
  for (const b of bookings) {
    // интерные брони (s203) — сотрудники, не клиенты: в счётчики клиентов,
    // оплат и отмен дашборда не идут
    if (b.internal === true) continue
    all += 1
    if (b.status === 'cancelled') cancelled.push(b)
    else if (b.status === 'noshow') noshow.push(b)
    else if (b.korekce === true) korekce.push(b)
    else payed.push(b)
  }

  const now = new Date()
  const pastPayed = payed.filter((b) => {
    if (!b.endsAt) return false
    const date = parseISO(b.endsAt)
    return isBefore(date, now) || isEqual(date, now)
  })

  const toMetric = (list: MirrorBooking[]): InputItemReservation[] =>
    list.filter((b) => b.endsAt).map((b) => ({ ends_at: b.endsAt as string }))

  const dataMetrics = groupCountReservationByDate({
    Payed: toMetric(payed),
    Canceled: toMetric(cancelled),
    Noshow: toMetric(noshow),
  })

  const monthReservationIndex = (countCreatedMonthReservation / day).toFixed(1)

  return {
    all,
    cancelled: cancelled.length,
    noshow: noshow.length,
    payed: payed.length,
    pastPayed: pastPayed.length,
    fixed: korekce.length, // бесплатные коррекции (s258)
    dataMetrics: dataMetrics || [],
    countCreatedMonthReservation,
    countCreatedTodayReservation,
    monthReservationIndex: monthReservationIndex || 0,
  }
}
