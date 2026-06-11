import { NoonaHQ } from '../../../../lib/noona'
import { fetchEmployees } from '../../noona/fetch/masterServices'

// Загрузка мастеров по слотам Noona за месяц.
// Модель (проверено на проде): per-employee графика в Noona НЕТ (work_hours пуст) —
// выходные/нерабочее время мастеров ведутся как blocked_times («Nepracovni doba»).
// Капацита дня мастера = часы салона (opening_hours) − его блокировки (blocked_times).
// Занято = брони (events, кроме cancelled; noshow считается — слот был занят).
// Загрузка % = занято / капацита.

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

interface RawEvent {
  employee?: string
  status?: string
  event_date?: string // 'YYYY-MM-DD'
  starts_at?: string
  ends_at?: string
}

interface RawBlocked {
  employee?: string
  date?: string // 'YYYY-MM-DD'
  duration?: number // минуты
  starts_at?: string
  ends_at?: string
}

type OpeningHoursResponse = Record<string, Array<{ starts_at?: string; ends_at?: string }>>

export interface DayLoad {
  date: string // 'YYYY-MM-DD'
  capacityMin: number
  blockedMin: number
  bookedMin: number
  bookings: number
  pct: number | null // null = нет капациты (полный выходной)
}

export interface MasterLoadRow {
  employeeId: string
  name: string
  days: DayLoad[]
  workingDays: number
  capacityMin: number
  bookedMin: number
  bookings: number
  pct: number | null
  // только прошедшие дни (≤ сегодня) — чтобы текущий месяц не занижался пустым будущим
  pastCapacityMin: number
  pastBookedMin: number
  pastPct: number | null
}

export interface MasterLoadTotals {
  workingDays: number
  capacityMin: number
  bookedMin: number
  bookings: number
  pct: number | null
  pastCapacityMin: number
  pastBookedMin: number
  pastPct: number | null
}

export interface MasterLoadResult {
  rows: MasterLoadRow[]
  totals: MasterLoadTotals
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
export const dateToStr = (d: Date) => dayStr(d.getFullYear(), d.getMonth(), d.getDate())

const minutesFromHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const calcPct = (booked: number, capacity: number): number | null =>
  capacity > 0 ? Math.round((booked / capacity) * 100) : null

// month — 0-based (как getMonth())
export const getMasterLoad = (month: number, year: number): Promise<MasterLoadResult> => {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return getMasterLoadRange(dayStr(year, month, 1), dayStr(year, month, lastDay))
}

// Произвольный диапазон дат (включительно), 'YYYY-MM-DD'
export const getMasterLoadRange = async (
  fromStr: string,
  toStr: string,
): Promise<MasterLoadResult> => {
  // События тянем с запасом +1 день (фильтр Noona — UTC, event_date — локальная дата),
  // потом отбрасываем по event_date вне диапазона.
  const [ty, tm, td] = toStr.split('-').map(Number)
  const dayAfter = new Date(ty, tm - 1, td + 1)
  const eventsFilter = JSON.stringify({
    from: `${fromStr}T00:00:00.000Z`,
    to: `${dateToStr(dayAfter)}T23:59:59.999Z`,
  })
  const eventsParams = new URLSearchParams()
  eventsParams.append('filter', eventsFilter)
  for (const f of ['employee', 'status', 'event_date', 'starts_at', 'ends_at']) {
    eventsParams.append('select', f)
  }

  const openingParams = new URLSearchParams()
  openingParams.append('filter', JSON.stringify({ from: fromStr, to: toStr }))

  const [employees, openingRes, blockedRes, eventsRes] = await Promise.all([
    fetchEmployees(),
    NoonaHQ.get<OpeningHoursResponse>(`/${COMPANY_ID}/opening_hours?${openingParams.toString()}`),
    NoonaHQ.get<RawBlocked[]>(`/${COMPANY_ID}/blocked_times?from=${fromStr}&to=${toStr}`),
    NoonaHQ.get<RawEvent[]>(`/${COMPANY_ID}/events?${eventsParams.toString()}`),
  ])

  // Часы салона по дням
  const openMinByDate = new Map<string, number>()
  const opening = openingRes.data || {}
  for (const [date, windows] of Object.entries(opening)) {
    const min = (windows || []).reduce((acc, w) => {
      if (!w.starts_at || !w.ends_at) return acc
      return acc + Math.max(0, minutesFromHHMM(w.ends_at) - minutesFromHHMM(w.starts_at))
    }, 0)
    openMinByDate.set(date, min)
  }

  // Блокировки мастера по дням
  const blockedMin = new Map<string, number>() // `${employee}|${date}` → мин
  for (const b of Array.isArray(blockedRes.data) ? blockedRes.data : []) {
    if (!b.employee || !b.date) continue
    let dur = b.duration ?? 0
    if (!dur && b.starts_at && b.ends_at) {
      dur = Math.max(0, (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)
    }
    const key = `${b.employee}|${b.date}`
    blockedMin.set(key, (blockedMin.get(key) || 0) + dur)
  }

  // Брони мастера по дням
  const bookedMin = new Map<string, number>()
  const bookedCount = new Map<string, number>()
  for (const e of Array.isArray(eventsRes.data) ? eventsRes.data : []) {
    if (!e.employee || !e.event_date || e.status === 'cancelled') continue
    if (e.event_date < fromStr || e.event_date > toStr) continue
    if (!e.starts_at || !e.ends_at) continue
    const dur = Math.max(0, (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000)
    const key = `${e.employee}|${e.event_date}`
    bookedMin.set(key, (bookedMin.get(key) || 0) + dur)
    bookedCount.set(key, (bookedCount.get(key) || 0) + 1)
  }

  const todayStr = dateToStr(new Date())

  // Список дат диапазона (включительно)
  const allDates: string[] = []
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  for (let cur = new Date(fy, fm - 1, fd); dateToStr(cur) <= toStr; cur.setDate(cur.getDate() + 1)) {
    allDates.push(dateToStr(cur))
  }

  const rows: MasterLoadRow[] = employees.map((emp) => {
    const days: DayLoad[] = []
    let capacitySum = 0
    let bookedSum = 0
    let bookingsSum = 0
    let workingDays = 0
    let pastCapacity = 0
    let pastBooked = 0

    for (const date of allDates) {
      const openMin = openMinByDate.get(date) || 0
      const key = `${emp.id}|${date}`
      const blocked = Math.min(blockedMin.get(key) || 0, openMin)
      const capacity = Math.max(0, openMin - blocked)
      const booked = bookedMin.get(key) || 0
      const count = bookedCount.get(key) || 0

      if (capacity <= 0 && booked <= 0) continue

      days.push({
        date,
        capacityMin: capacity,
        blockedMin: blocked,
        bookedMin: booked,
        bookings: count,
        pct: calcPct(booked, capacity),
      })

      capacitySum += capacity
      bookedSum += booked
      bookingsSum += count
      if (capacity > 0) workingDays++
      if (date <= todayStr) {
        pastCapacity += capacity
        pastBooked += booked
      }
    }

    return {
      employeeId: emp.id,
      name: emp.name,
      days,
      workingDays,
      capacityMin: capacitySum,
      bookedMin: bookedSum,
      bookings: bookingsSum,
      pct: calcPct(bookedSum, capacitySum),
      pastCapacityMin: pastCapacity,
      pastBookedMin: pastBooked,
      pastPct: calcPct(pastBooked, pastCapacity),
    }
  })

  // Сортировка: самые загруженные сверху, без капациты — в конец
  rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))

  const totals: MasterLoadTotals = rows.reduce(
    (acc, r) => ({
      workingDays: acc.workingDays + r.workingDays,
      capacityMin: acc.capacityMin + r.capacityMin,
      bookedMin: acc.bookedMin + r.bookedMin,
      bookings: acc.bookings + r.bookings,
      pct: null,
      pastCapacityMin: acc.pastCapacityMin + r.pastCapacityMin,
      pastBookedMin: acc.pastBookedMin + r.pastBookedMin,
      pastPct: null,
    }),
    {
      workingDays: 0,
      capacityMin: 0,
      bookedMin: 0,
      bookings: 0,
      pct: null,
      pastCapacityMin: 0,
      pastBookedMin: 0,
      pastPct: null,
    },
  )
  totals.pct = calcPct(totals.bookedMin, totals.capacityMin)
  totals.pastPct = calcPct(totals.pastBookedMin, totals.pastCapacityMin)

  return { rows, totals }
}

export const fmtHours = (min: number): string => {
  const h = min / 60
  return `${Math.round(h * 10) / 10} ч`
}
