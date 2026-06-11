import { NoonaHQ } from '../../../../lib/noona'
import { fetchEmployees } from '../../noona/fetch/masterServices'

// «Окна» (дыры) в расписании мастеров: свободные интервалы внутри рабочего
// времени (часы салона − блокировки) между бронями. «Мёртвое окно» = 15–90 мин —
// в него трудно продать услугу; большие свободные блоки (>90 мин) ещё продаваемы.

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export const DEAD_MIN = 15
export const DEAD_MAX = 90

interface Interval {
  start: number // минуты от полуночи (локальное время)
  end: number
}

export interface GapInterval {
  start: string // 'HH:MM'
  end: string
  durationMin: number
  dead: boolean
}

export interface DayGaps {
  date: string // 'YYYY-MM-DD'
  capacityMin: number
  bookedMin: number
  gaps: GapInterval[]
  deadCount: number
  deadMin: number
  freeMin: number
}

export interface MasterGapsRow {
  employeeId: string
  name: string
  days: DayGaps[]
  deadCount: number
  deadMin: number
  freeMin: number
  bookedMin: number
}

interface RawBlocked {
  employee?: string
  date?: string
  starts_at?: string
  ends_at?: string
}

interface RawEvent {
  employee?: string
  status?: string
  event_date?: string
  starts_at?: string
  ends_at?: string
}

type OpeningHoursResponse = Record<string, Array<{ starts_at?: string; ends_at?: string }>>

const hhmmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const isoToMin = (iso: string): number => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const minToHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`

// Вычитание занятых интервалов из окна: возвращает свободные куски
const subtract = (window: Interval, busy: Interval[]): Interval[] => {
  const sorted = busy
    .filter((b) => b.end > window.start && b.start < window.end)
    .sort((a, b) => a.start - b.start)
  const free: Interval[] = []
  let cursor = window.start
  for (const b of sorted) {
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, window.end) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= window.end) break
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end })
  return free
}

export const getScheduleGaps = async (
  fromStr: string,
  toStr: string,
): Promise<MasterGapsRow[]> => {
  const openingParams = new URLSearchParams()
  openingParams.append('filter', JSON.stringify({ from: fromStr, to: toStr }))

  const eventsParams = new URLSearchParams()
  eventsParams.append(
    'filter',
    JSON.stringify({ from: `${fromStr}T00:00:00.000Z`, to: `${toStr}T23:59:59.999Z` }),
  )
  for (const f of ['employee', 'status', 'event_date', 'starts_at', 'ends_at']) {
    eventsParams.append('select', f)
  }

  const [employees, openingRes, blockedRes, eventsRes] = await Promise.all([
    fetchEmployees(),
    NoonaHQ.get<OpeningHoursResponse>(`/${COMPANY_ID}/opening_hours?${openingParams.toString()}`),
    NoonaHQ.get<RawBlocked[]>(`/${COMPANY_ID}/blocked_times?from=${fromStr}&to=${toStr}`),
    NoonaHQ.get<RawEvent[]>(`/${COMPANY_ID}/events?${eventsParams.toString()}`),
  ])

  const opening = openingRes.data || {}

  // Занятые интервалы per employee|date (блоки + брони)
  const busyMap = new Map<string, Interval[]>()
  const bookedMinMap = new Map<string, number>()
  const push = (key: string, iv: Interval) => {
    if (!busyMap.has(key)) busyMap.set(key, [])
    busyMap.get(key)!.push(iv)
  }

  for (const b of Array.isArray(blockedRes.data) ? blockedRes.data : []) {
    if (!b.employee || !b.date || !b.starts_at || !b.ends_at) continue
    push(`${b.employee}|${b.date}`, { start: isoToMin(b.starts_at), end: isoToMin(b.ends_at) })
  }
  for (const e of Array.isArray(eventsRes.data) ? eventsRes.data : []) {
    if (!e.employee || !e.event_date || e.status === 'cancelled') continue
    if (!e.starts_at || !e.ends_at) continue
    if (e.event_date < fromStr || e.event_date > toStr) continue
    const iv = { start: isoToMin(e.starts_at), end: isoToMin(e.ends_at) }
    const key = `${e.employee}|${e.event_date}`
    push(key, iv)
    bookedMinMap.set(key, (bookedMinMap.get(key) || 0) + Math.max(0, iv.end - iv.start))
  }

  return employees.map((emp) => {
    const days: DayGaps[] = []
    let deadCount = 0
    let deadMin = 0
    let freeMin = 0
    let bookedMin = 0

    for (const [date, windows] of Object.entries(opening).sort()) {
      const key = `${emp.id}|${date}`
      const busy = busyMap.get(key) || []
      const booked = bookedMinMap.get(key) || 0
      const gaps: GapInterval[] = []
      let capacityMin = 0

      for (const w of windows || []) {
        if (!w.starts_at || !w.ends_at) continue
        const window: Interval = { start: hhmmToMin(w.starts_at), end: hhmmToMin(w.ends_at) }
        capacityMin += Math.max(0, window.end - window.start)
        for (const f of subtract(window, busy)) {
          const dur = f.end - f.start
          if (dur < DEAD_MIN) continue // мусорные щели не показываем
          gaps.push({
            start: minToHHMM(f.start),
            end: minToHHMM(f.end),
            durationMin: dur,
            dead: dur <= DEAD_MAX,
          })
        }
      }

      // день без единой брони и без свободных окон (полностью заблокирован) — пропускаем;
      // день без брони, но с капацитой — показываем (это сплошное свободное окно)
      if (gaps.length === 0 && booked === 0) continue

      const dayDead = gaps.filter((g) => g.dead)
      days.push({
        date,
        capacityMin,
        bookedMin: booked,
        gaps,
        deadCount: dayDead.length,
        deadMin: dayDead.reduce((a, g) => a + g.durationMin, 0),
        freeMin: gaps.reduce((a, g) => a + g.durationMin, 0),
      })
      deadCount += dayDead.length
      deadMin += dayDead.reduce((a, g) => a + g.durationMin, 0)
      freeMin += gaps.reduce((a, g) => a + g.durationMin, 0)
      bookedMin += booked
    }

    return { employeeId: emp.id, name: emp.name, days, deadCount, deadMin, freeMin, bookedMin }
  })
}
