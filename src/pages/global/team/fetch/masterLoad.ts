import {
  fetchMirrorBookingsRange,
  fetchMirrorEmployees,
  fetchSalonHoursRange,
  fetchTimeBlocksRange,
} from '../../../../lib/mirror'

// Загрузка мастеров по слотам за месяц. own-booking фаза 4: источники — НАША БД
// (salon-hour / time-block / booking / personal), Noona API не участвует.
// Модель та же: капацита дня мастера = часы салона − его блоки;
// занято = брони (кроме cancelled; noshow считается — слот был занят).
// Загрузка % = занято / капацита.
// ⚠️ Зеркало расписания покрывает окно синка (~[−30..+90] дней от импорта s99) —
// более старые месяцы покажут нулевую капациту (ограничение зеркала, не бага).

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
  const [employees, hours, blocks, bookings] = await Promise.all([
    fetchMirrorEmployees(),
    fetchSalonHoursRange(fromStr, toStr),
    fetchTimeBlocksRange(fromStr, toStr),
    fetchMirrorBookingsRange(fromStr, toStr),
  ])

  // Часы салона по дням (сумма окон; fallback close−open)
  const openMinByDate = new Map<string, number>()
  for (const h of hours) {
    const winSum = (h.windows || []).reduce((acc, w) => {
      if (!w.starts_at || !w.ends_at) return acc
      return acc + Math.max(0, minutesFromHHMM(w.ends_at) - minutesFromHHMM(w.starts_at))
    }, 0)
    const fallback = h.openMin != null && h.closeMin != null ? Math.max(0, h.closeMin - h.openMin) : 0
    openMinByDate.set(String(h.date), winSum || fallback)
  }

  // Блокировки мастера по дням
  const blockedMin = new Map<string, number>() // `${employee}|${date}` → мин
  for (const b of blocks) {
    if (!b.noonaEmployeeId || !b.date || !b.startsAt || !b.endsAt) continue
    const dur = Math.max(0, (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000)
    const key = `${b.noonaEmployeeId}|${b.date}`
    blockedMin.set(key, (blockedMin.get(key) || 0) + dur)
  }

  // Брони мастера по дням
  const bookedMin = new Map<string, number>()
  const bookedCount = new Map<string, number>()
  for (const e of bookings) {
    if (!e.noonaEmployeeId || !e.date || e.status === 'cancelled') continue
    if (!e.startsAt || !e.endsAt) continue
    const dur = Math.max(0, (new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime()) / 60000)
    const key = `${e.noonaEmployeeId}|${e.date}`
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
