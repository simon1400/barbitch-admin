// Фаза 2 (s99): дневной календарь-грид как в Noona.
// Брони — из ЗЕРКАЛА (booking, Strapi, read-only, PII → явный Bearer).
// Рабочие часы салона + блокировки мастеров (нерабочее время) + список активных
// мастеров — живьём из Noona (read-only GET, как модуль «Загрузка» masterLoad.ts):
// per-employee графики в Noona нет, нерабочее время = blocked_times.

import { Axios } from '../../../lib/api'
import { NoonaHQ } from '../../../lib/noona'

const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const authHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined
const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface CalendarService {
  title: string
  price: number | null
  durationMin: number | null
}

export interface CalendarBooking {
  id: number
  documentId: string
  clientNameRaw: string
  employeeNameRaw: string
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
  status: 'active' | 'checkedOut' | 'cancelled' | 'noshow'
  services: CalendarService[] | null
  totalPrice: number | null
  comment: string | null
  customerComment: string | null
  bsChannel: string | null
}

interface RawBlocked {
  employee?: string
  date?: string
  duration?: number
  starts_at?: string
  ends_at?: string
}
type OpeningHoursResponse = Record<string, Array<{ starts_at?: string; ends_at?: string }>>

export interface BlockedRange {
  startMin: number
  endMin: number
}

export interface MasterColumn {
  id: string // Noona employee id (день) или дата (неделя)
  name: string
  bookings: CalendarBooking[]
  blocks: BlockedRange[]
  showNow?: boolean // рисовать линию текущего времени в этой колонке
}

export interface CalendarEmployee {
  id: string
  name: string
}

export interface CalendarDay {
  openMin: number
  closeMin: number
  columns: MasterColumn[]
}

// Минуты от полуночи в часовом поясе Праги (сервер/браузер-независимо)
const HM_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const isoToMin = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const parts = HM_FMT.formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}
const hhmmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const DEFAULT_OPEN = 9 * 60
const DEFAULT_CLOSE = 20 * 60

interface NoonaEmp {
  id?: string
  name?: string
  display_name?: string
  available_for_bookings?: boolean
}

// blocked_times: `to` у эндпоинта ИСКЛЮЧАЮЩИЙ (from=to=день → пусто) → берём day+1
const nextDay = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface MirrorSalonHour {
  date: string
  openMin: number | null
  closeMin: number | null
}
interface MirrorTimeBlock {
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
}

// Расписание дня из ЗЕРКАЛА (salon-hour + time-blocks). Если для даты нет
// salon-hour (не синкана) — fallback на живой Noona. Возвращает окно + блоки.
async function fetchSchedule(
  dateStr: string,
): Promise<{ openMin: number; closeMin: number; blocksByEmp: Map<string, BlockedRange[]> }> {
  const [hourRes, blockRes] = await Promise.all([
    Axios.get(`/api/salon-hours?filters[date][$eq]=${dateStr}`, { headers: authHeaders }) as Promise<
      MirrorSalonHour[]
    >,
    Axios.get(`/api/time-blocks?filters[date][$eq]=${dateStr}&pagination[pageSize]=300`, {
      headers: authHeaders,
    }) as Promise<MirrorTimeBlock[]>,
  ])
  const hour = (hourRes || [])[0]

  // Дата НЕ синкана (нет salon-hour) → берём расписание живьём из Noona
  if (!hour) return fetchScheduleLive(dateStr)

  let openMin = DEFAULT_OPEN
  let closeMin = DEFAULT_CLOSE
  if (hour.openMin != null && hour.closeMin != null) {
    openMin = hour.openMin
    closeMin = hour.closeMin
  }
  const blocksByEmp = new Map<string, BlockedRange[]>()
  for (const b of blockRes || []) {
    const s = isoToMin(b.startsAt)
    const e = isoToMin(b.endsAt)
    if (!b.noonaEmployeeId || s == null || e == null || e <= s) continue
    const arr = blocksByEmp.get(b.noonaEmployeeId) || []
    arr.push({ startMin: s, endMin: e })
    blocksByEmp.set(b.noonaEmployeeId, arr)
  }
  return { openMin, closeMin, blocksByEmp }
}

// Fallback: рабочие часы + блоки живьём из Noona (read-only)
async function fetchScheduleLive(
  dateStr: string,
): Promise<{ openMin: number; closeMin: number; blocksByEmp: Map<string, BlockedRange[]> }> {
  const openingParams = new URLSearchParams()
  openingParams.append('filter', JSON.stringify({ from: dateStr, to: dateStr }))
  const [openingRes, blockedRes] = await Promise.all([
    NoonaHQ.get<OpeningHoursResponse>(`/${COMPANY_ID}/opening_hours?${openingParams.toString()}`),
    NoonaHQ.get<RawBlocked[]>(`/${COMPANY_ID}/blocked_times?from=${dateStr}&to=${nextDay(dateStr)}`),
  ])
  let openMin = DEFAULT_OPEN
  let closeMin = DEFAULT_CLOSE
  const windows = (openingRes.data || {})[dateStr] || []
  const starts = windows.map((w) => (w.starts_at ? hhmmToMin(w.starts_at) : null)).filter((v): v is number => v != null)
  const ends = windows.map((w) => (w.ends_at ? hhmmToMin(w.ends_at) : null)).filter((v): v is number => v != null)
  if (starts.length && ends.length) {
    openMin = Math.min(...starts)
    closeMin = Math.max(...ends)
  }
  const blocksByEmp = new Map<string, BlockedRange[]>()
  for (const b of Array.isArray(blockedRes.data) ? blockedRes.data : []) {
    if (!b.employee || (b.date && b.date !== dateStr)) continue
    const s = isoToMin(b.starts_at)
    let e = isoToMin(b.ends_at)
    if (s == null && b.duration && b.starts_at == null) continue
    if (s != null && e == null && b.duration) e = s + b.duration
    if (s == null || e == null || e <= s) continue
    const arr = blocksByEmp.get(b.employee) || []
    arr.push({ startMin: s, endMin: e })
    blocksByEmp.set(b.employee, arr)
  }
  return { openMin, closeMin, blocksByEmp }
}

export async function fetchCalendarDay(dateStr: string): Promise<CalendarDay> {
  const [bookingsRes, employeesRes, schedule] = await Promise.all([
    Axios.get(
      `/api/bookings?filters[date][$eq]=${dateStr}&sort=startsAt:asc&pagination[pageSize]=200`,
      { headers: authHeaders },
    ) as Promise<CalendarBooking[]>,
    NoonaHQ.get<NoonaEmp[]>(`/${COMPANY_ID}/employees`),
    fetchSchedule(dateStr),
  ])

  const bookings = bookingsRes || []

  // Активные мастера (видимые в календаре) — порядок как отдаёт Noona
  const employees = (Array.isArray(employeesRes.data) ? employeesRes.data : [])
    .filter((e) => e.id && e.available_for_bookings === true)
    .map((e) => ({ id: e.id as string, name: (e.name ?? e.display_name ?? e.id) as string }))

  let { openMin, closeMin } = schedule
  const { blocksByEmp } = schedule

  // Брони по мастеру (по noonaEmployeeId зеркала)
  const bookingsByEmp = new Map<string, CalendarBooking[]>()
  const orphan: CalendarBooking[] = []
  for (const bk of bookings) {
    if (bk.noonaEmployeeId && employees.some((e) => e.id === bk.noonaEmployeeId)) {
      const arr = bookingsByEmp.get(bk.noonaEmployeeId) || []
      arr.push(bk)
      bookingsByEmp.set(bk.noonaEmployeeId, arr)
    } else {
      orphan.push(bk)
    }
  }

  const isToday = todayStrPrague() === dateStr
  const columns: MasterColumn[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    bookings: bookingsByEmp.get(e.id) || [],
    blocks: blocksByEmp.get(e.id) || [],
    showNow: isToday,
  }))

  // Брони бывших сотрудников (нет в списке активных) — отдельной колонкой, если есть
  if (orphan.length) {
    const byName = new Map<string, CalendarBooking[]>()
    for (const b of orphan) {
      const key = b.employeeNameRaw || 'Bývalý mistr'
      const arr = byName.get(key) || []
      arr.push(b)
      byName.set(key, arr)
    }
    for (const [name, list] of byName) {
      columns.push({ id: `orphan:${name}`, name, bookings: list, blocks: [] })
    }
  }

  // Расширить окно, если есть брони/блоки за его пределами
  for (const col of columns) {
    for (const b of col.bookings) {
      const s = isoToMin(b.startsAt)
      const e = isoToMin(b.endsAt)
      if (s != null) openMin = Math.min(openMin, s)
      if (e != null) closeMin = Math.max(closeMin, e)
    }
    for (const bl of col.blocks) {
      openMin = Math.min(openMin, bl.startMin)
      closeMin = Math.max(closeMin, bl.endMin)
    }
  }
  // Округлить до часа
  openMin = Math.floor(openMin / 60) * 60
  closeMin = Math.ceil(closeMin / 60) * 60

  return { openMin, closeMin, columns }
}

// Лейн-паковка пересекающихся броней внутри колонки (side-by-side, как Noona)
export interface PositionedBooking {
  booking: CalendarBooking
  startMin: number
  endMin: number
  lane: number
  lanes: number
}

export function packColumn(bookings: CalendarBooking[]): PositionedBooking[] {
  const items = bookings
    .map((b) => ({ b, s: isoToMin(b.startsAt), e: isoToMin(b.endsAt) }))
    .filter((x): x is { b: CalendarBooking; s: number; e: number } => x.s != null && x.e != null && x.e > x.s)
    .sort((a, b) => a.s - b.s || a.e - b.e)

  // Группируем в кластеры пересечения, внутри — жадно по лейнам
  const result: PositionedBooking[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return
    const laneEnds: number[] = []
    const placed = cluster.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.s)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(it.e)
      } else {
        laneEnds[lane] = it.e
      }
      return { it, lane }
    })
    const lanes = laneEnds.length
    for (const { it, lane } of placed) {
      result.push({ booking: it.b, startMin: it.s, endMin: it.e, lane, lanes })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.e)
  }
  flush()
  return result
}

// 'YYYY-MM-DD' сегодня в Праге
export function todayStrPrague(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
}

// Текущее время в минутах от полуночи (Прага) — позиция линии now
export function nowMinPrague(): number | null {
  return isoToMin(new Date().toISOString())
}

// ── Недельный вид: неделя ОДНОГО мастера, колонки = дни ──
const WEEKDAYS_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

export async function fetchWeekEmployees(): Promise<CalendarEmployee[]> {
  const res = await NoonaHQ.get<NoonaEmp[]>(`/${COMPANY_ID}/employees`)
  return (Array.isArray(res.data) ? res.data : [])
    .filter((e) => e.id && e.available_for_bookings === true)
    .map((e) => ({ id: e.id as string, name: (e.name ?? e.display_name ?? e.id) as string }))
}

// monday = 'YYYY-MM-DD' (Пн), employeeId = Noona id
export async function fetchCalendarWeek(
  monday: string,
  employee: CalendarEmployee,
): Promise<CalendarDay> {
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = monday.split('-').map(Number)
    const dt = new Date(y, m - 1, d + i)
    days.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
  }
  const sunday = days[6]

  const [bookingsRes, hoursRes, blocksRes] = await Promise.all([
    Axios.get(
      `/api/bookings?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&filters[noonaEmployeeId][$eq]=${employee.id}&sort=startsAt:asc&pagination[pageSize]=300`,
      { headers: authHeaders },
    ) as Promise<CalendarBooking[]>,
    Axios.get(`/api/salon-hours?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&pagination[pageSize]=10`, {
      headers: authHeaders,
    }) as Promise<MirrorSalonHour[]>,
    Axios.get(
      `/api/time-blocks?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&filters[noonaEmployeeId][$eq]=${employee.id}&pagination[pageSize]=100`,
      { headers: authHeaders },
    ) as Promise<MirrorTimeBlock[]>,
  ])

  const bookings = bookingsRes || []
  const bookingsByDate = new Map<string, CalendarBooking[]>()
  for (const b of bookings) {
    const arr = bookingsByDate.get(b.date) || []
    arr.push(b)
    bookingsByDate.set(b.date, arr)
  }
  const blocksByDate = new Map<string, BlockedRange[]>()
  for (const bl of blocksRes || []) {
    const s = isoToMin(bl.startsAt)
    const e = isoToMin(bl.endsAt)
    if (s == null || e == null || e <= s) continue
    const arr = blocksByDate.get(bl.date) || []
    arr.push({ startMin: s, endMin: e })
    blocksByDate.set(bl.date, arr)
  }

  // Окно недели = min open / max close по synced-дням (fallback default)
  let openMin = DEFAULT_OPEN
  let closeMin = DEFAULT_CLOSE
  const hours = hoursRes || []
  const opens = hours.map((h) => h.openMin).filter((v): v is number => v != null)
  const closes = hours.map((h) => h.closeMin).filter((v): v is number => v != null)
  if (opens.length && closes.length) {
    openMin = Math.min(...opens)
    closeMin = Math.max(...closes)
  }

  const today = todayStrPrague()
  const columns: MasterColumn[] = days.map((date) => {
    const [y, m, d] = date.split('-').map(Number)
    const wd = WEEKDAYS_CS[new Date(y, m - 1, d).getDay()]
    return {
      id: date,
      name: `${wd} ${d}.${m}.`,
      bookings: bookingsByDate.get(date) || [],
      blocks: blocksByDate.get(date) || [],
      showNow: date === today,
    }
  })

  // Расширить окно под брони/блоки
  for (const col of columns) {
    for (const b of col.bookings) {
      const s = isoToMin(b.startsAt)
      const e = isoToMin(b.endsAt)
      if (s != null) openMin = Math.min(openMin, s)
      if (e != null) closeMin = Math.max(closeMin, e)
    }
    for (const bl of col.blocks) {
      openMin = Math.min(openMin, bl.startMin)
      closeMin = Math.max(closeMin, bl.endMin)
    }
  }
  openMin = Math.floor(openMin / 60) * 60
  closeMin = Math.ceil(closeMin / 60) * 60

  return { openMin, closeMin, columns }
}
