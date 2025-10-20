import type { InputItemReservation } from './fetchHelpers'

import { isBefore, isEqual, parseISO } from 'date-fns'
import { getMonthRange } from '../../../utils/getMonthRange'
import { NoonaHQ } from '../../../lib/noona'

import { groupCountReservationByDate } from './fetchHelpers'

interface EventItem {
  status?: string
  event_types: { color?: string }[]
  customer_name: string
  ends_at: string // ISO string даты
  [key: string]: any
}

export const splitEventsByStatus = (events: EventItem[]) => {
  const cancelled: EventItem[] = []
  const noshow: EventItem[] = []
  const others: EventItem[] = []

  for (const event of events) {
    if (event.status === 'cancelled') {
      cancelled.push(event)
    } else if (event.status === 'noshow') {
      noshow.push(event)
    } else {
      others.push(event)
    }
  }

  return { cancelled, noshow, others }
}

export const groupByColor = (events: EventItem[]) => {
  const groups: Record<string, EventItem[]> = {}

  for (const event of events) {
    const color = event.event_types?.[0]?.color || 'unknown'
    if (!groups[color]) {
      groups[color] = []
    }
    groups[color].push(event)
  }

  return groups
}

export const getEvents = async (month: number) => {
  const { firstDay, lastDay } = getMonthRange(2025, month)
  const queryString = new URLSearchParams()
  const queryString2 = new URLSearchParams()
  const queryString3 = new URLSearchParams()

  const today = new Date()
  let day = today.getDate()
  if (today.getMonth() !== month) {
    day = new Date(new Date().getFullYear(), month + 1, 0).getDate()
  }

  const startToday = new Date(today)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(today)
  endToday.setHours(23, 59, 59, 999)

  const queryParams: Record<string, string | string[]> = {
    select: ['id', 'event_types.color', 'customer_name', 'status', 'ends_at'],
    filter: JSON.stringify({
      from: firstDay.toISOString(),
      to: lastDay.toISOString(),
    }),
  }

  const queryParams2: Record<string, string | string[]> = {
    select: [''],
    filter: JSON.stringify({
      created_from: firstDay.toISOString(),
      created_to: lastDay.toISOString(),
    }),
    include_count_header: 'true',
  }
  const queryParams3: Record<string, string | string[]> = {
    select: [''],
    filter: JSON.stringify({
      created_from: startToday.toISOString(),
      created_to: endToday.toISOString(),
    }),
    include_count_header: 'true',
  }

  Object.entries(queryParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val) => queryString.append(key, val))
    } else {
      queryString.append(key, String(value))
    }
  })

  Object.entries(queryParams2).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val) => queryString2.append(key, val))
    } else {
      queryString2.append(key, String(value))
    }
  })
  Object.entries(queryParams3).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val) => queryString3.append(key, val))
    } else {
      queryString3.append(key, String(value))
    }
  })

  const data = await NoonaHQ.get(`/8qcJwRg6dbNh6Gqvm/events?${queryString.toString()}`)
  const { cancelled, noshow, others } = splitEventsByStatus(data.data)
  const groupedByColor = groupByColor(others)

  const now = new Date()

  const filteredBeenPayed = groupedByColor['#FF787D']?.filter((item) => {
    const date = parseISO(item.ends_at)
    return isBefore(date, now) || isEqual(date, now)
  }) || []

  const dataMetrics = groupCountReservationByDate({
    Payed: (groupedByColor['#FF787D'] || []) as InputItemReservation[],
    Canceled: cancelled as InputItemReservation[],
    Noshow: noshow as InputItemReservation[],
  })

  const createdReservationData = await NoonaHQ.get(
    `/8qcJwRg6dbNh6Gqvm/events?${queryString2.toString()}`,
  )
  const createdReservationTodayData = await NoonaHQ.get(
    `/8qcJwRg6dbNh6Gqvm/events?${queryString3.toString()}`,
  )

  const countCreatedMonthReservation = createdReservationData.headers['x-total-count']
  const countCreatedTodayReservation = createdReservationTodayData.headers['x-total-count']
  const monthReservationIndex = (countCreatedMonthReservation / day).toFixed(1)

  const result = {
    all: data.data.length,
    cancelled: cancelled?.length || 0,
    noshow: noshow?.length || 0,
    payed: groupedByColor['#FF787D']?.length || 0,
    pastPayed: filteredBeenPayed?.length || 0,
    free: groupedByColor['#3d4881']?.length || 0,
    personal: groupedByColor['#59c3b9']?.length || 0,
    fixed: groupedByColor['#822949']?.length || 0,
    dataMetrics: dataMetrics || [],
    countCreatedMonthReservation: countCreatedMonthReservation || 0,
    countCreatedTodayReservation: countCreatedTodayReservation || 0,
    monthReservationIndex: monthReservationIndex || 0,
  }
  return result
}
