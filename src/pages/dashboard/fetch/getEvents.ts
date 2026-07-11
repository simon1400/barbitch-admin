import type { InputItemReservation } from './fetchHelpers'

import { isBefore, isEqual, parseISO } from 'date-fns'
import { getMonthRange } from '../../../utils/getMonthRange'
import { fetchMirrorBookingsRange, countBookingsCreatedBetween } from '../../../lib/mirror'
import type { MirrorBooking } from '../../../lib/mirror'

import { groupCountReservationByDate } from './fetchHelpers'

// Метрики резерваций месяца для дашборда/GlobalPage. own-booking фаза 4:
// источник — НАША БД (коллекция booking), Noona API не участвует.
// Маппинг против старой Noona-версии: цветовые категории event_types (#FF787D
// «payed» / #822949 «fixed») в зеркале не существуют → «payed» = все брони
// кроме cancelled/noshow (то, что реально приносит визиты), «fixed» = 0.

const dayStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const getEvents = async (month: number, year: number) => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const today = new Date()
  let day = today.getDate()
  if (today.getMonth() !== month || today.getFullYear() !== year) {
    day = new Date(year, month + 1, 0).getDate()
  }

  const startToday = new Date(today)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(today)
  endToday.setHours(23, 59, 59, 999)

  const [bookings, countCreatedMonthReservation, countCreatedTodayReservation] = await Promise.all([
    fetchMirrorBookingsRange(dayStr(firstDay), dayStr(lastDay)),
    countBookingsCreatedBetween(firstDay.toISOString(), lastDay.toISOString()),
    countBookingsCreatedBetween(startToday.toISOString(), endToday.toISOString()),
  ])

  const cancelled: MirrorBooking[] = []
  const noshow: MirrorBooking[] = []
  const payed: MirrorBooking[] = []
  for (const b of bookings) {
    if (b.status === 'cancelled') cancelled.push(b)
    else if (b.status === 'noshow') noshow.push(b)
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
    all: bookings.length,
    cancelled: cancelled.length,
    noshow: noshow.length,
    payed: payed.length,
    pastPayed: pastPayed.length,
    fixed: 0, // цветовая категория Noona (#822949) — в собственной системе не существует
    dataMetrics: dataMetrics || [],
    countCreatedMonthReservation,
    countCreatedTodayReservation,
    monthReservationIndex: monthReservationIndex || 0,
  }
}
