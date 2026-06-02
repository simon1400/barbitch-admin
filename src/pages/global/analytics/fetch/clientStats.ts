import { NoonaHQ } from '../../../../lib/noona'

// Статистика клиентов из Noona: новые vs повторные по месяцам + загрузка по дням недели.
// Источник — события (брони) Noona. Клиент = уникальный customer id.
// Отменённые брони (status === 'cancelled') исключаются из всех подсчётов.

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string
const HISTORY_START_YEAR = 2024 // салон открылся в ноябре 2024 — нужна вся история для «первого визита»

interface RawEvent {
  customer?: string
  status?: string
  event_date?: string // 'YYYY-MM-DD'
}

export interface MonthlyClientRow {
  month: string // 'YYYY-MM'
  label: string // 'Дек 2025'
  total: number
  newClients: number
  returning: number
  newPct: number
  partial: boolean
}

export interface WeekdayRow {
  dow: number
  label: string
  reservations: number
  clients: number
  workingDays: number
  reservationsPerDay: number
  clientsPerDay: number
}

export interface MonthlyTotals {
  total: number
  newClients: number
  returning: number
  newPct: number
  avgNewPerMonth: number
}

export interface ClientStats {
  monthlyRows: MonthlyClientRow[]
  currentRow: MonthlyClientRow
  monthlyTotals: MonthlyTotals
  weekdayRows: WeekdayRow[]
  weekdayWindowLabel: string
  totalClientsEver: number
}

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const DOW_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

const ym = (d: string) => d.slice(0, 7)
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `${MONTHS_RU[Number(mm) - 1]} ${y}`
}

const fetchYear = async (year: number): Promise<RawEvent[]> => {
  const filter = JSON.stringify({
    from: `${year}-01-01T00:00:00.000Z`,
    to: `${year + 1}-01-01T00:00:00.000Z`,
  })
  const params = new URLSearchParams()
  params.append('filter', filter)
  for (const f of ['customer', 'status', 'event_date']) params.append('select', f)
  const res = await NoonaHQ.get<RawEvent[]>(`/${COMPANY_ID}/events?${params.toString()}`)
  return Array.isArray(res.data) ? res.data : []
}

let cache: { ts: number; events: RawEvent[] } | null = null
const CACHE_TTL = 5 * 60 * 1000

const fetchAllEvents = async (force: boolean): Promise<RawEvent[]> => {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache.events
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = HISTORY_START_YEAR; y <= currentYear; y++) years.push(y)
  const chunks = await Promise.all(years.map((y) => fetchYear(y)))
  const events = chunks.flat()
  cache = { ts: Date.now(), events }
  return events
}

export const getClientStats = async (force = false): Promise<ClientStats> => {
  const events = await fetchAllEvents(force)
  const valid = events.filter((e) => e.status !== 'cancelled' && e.event_date && e.customer)

  // Первый визит каждого клиента за всю историю (по дате визита)
  const firstDate = new Map<string, string>()
  for (const e of valid) {
    const cur = firstDate.get(e.customer!)
    if (!cur || e.event_date! < cur) firstDate.set(e.customer!, e.event_date!)
  }

  // Активные (уникальные) клиенты по месяцам
  const activeByMonth = new Map<string, Set<string>>()
  for (const e of valid) {
    const m = ym(e.event_date!)
    if (!activeByMonth.has(m)) activeByMonth.set(m, new Set())
    activeByMonth.get(m)!.add(e.customer!)
  }

  const buildRow = (m: string, partial: boolean): MonthlyClientRow => {
    const set = activeByMonth.get(m) || new Set<string>()
    let newClients = 0
    let returning = 0
    for (const c of set) {
      if (ym(firstDate.get(c)!) === m) newClients++
      else returning++
    }
    const total = set.size
    return {
      month: m,
      label: monthLabel(m),
      total,
      newClients,
      returning,
      newPct: total ? Math.round((newClients / total) * 100) : 0,
      partial,
    }
  }

  const now = new Date()
  const months: string[] = []
  for (let i = 6; i >= 1; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  const monthlyRows = months.map((m) => buildRow(m, false))
  const currentRow = buildRow(monthKey(now), true)

  const monthlyTotals: MonthlyTotals = {
    total: monthlyRows.reduce((a, r) => a + r.total, 0),
    newClients: monthlyRows.reduce((a, r) => a + r.newClients, 0),
    returning: monthlyRows.reduce((a, r) => a + r.returning, 0),
    newPct: 0,
    avgNewPerMonth: 0,
  }
  monthlyTotals.newPct = monthlyTotals.total
    ? Math.round((monthlyTotals.newClients / monthlyTotals.total) * 100)
    : 0
  monthlyTotals.avgNewPerMonth = monthlyRows.length
    ? Math.round(monthlyTotals.newClients / monthlyRows.length)
    : 0

  // Загрузка по дням недели за последние 6 месяцев (только прошедшие визиты)
  const winStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  const startStr = dayKey(winStart)
  const todayStr = dayKey(now)
  const windowEvents = valid.filter(
    (e) => e.event_date! >= startStr && e.event_date! <= todayStr,
  )

  const resvByDow = new Map<number, number>()
  const daysByDow = new Map<number, Set<string>>()
  const visitsByDow = new Map<number, Set<string>>()
  for (const e of windowEvents) {
    const [y, mm, dd] = e.event_date!.split('-').map(Number)
    const dow = new Date(y, mm - 1, dd).getDay()
    resvByDow.set(dow, (resvByDow.get(dow) || 0) + 1)
    if (!daysByDow.has(dow)) daysByDow.set(dow, new Set())
    daysByDow.get(dow)!.add(e.event_date!)
    if (!visitsByDow.has(dow)) visitsByDow.set(dow, new Set())
    visitsByDow.get(dow)!.add(`${e.event_date!}|${e.customer}`)
  }

  const order = [1, 2, 3, 4, 5, 6, 0] // Пн..Вс
  const weekdayRows: WeekdayRow[] = order.map((d) => {
    const reservations = resvByDow.get(d) || 0
    const workingDays = daysByDow.get(d)?.size || 0
    const clients = visitsByDow.get(d)?.size || 0
    return {
      dow: d,
      label: DOW_RU[d],
      reservations,
      clients,
      workingDays,
      reservationsPerDay: workingDays ? Math.round((reservations / workingDays) * 10) / 10 : 0,
      clientsPerDay: workingDays ? Math.round((clients / workingDays) * 10) / 10 : 0,
    }
  })

  return {
    monthlyRows,
    currentRow,
    monthlyTotals,
    weekdayRows,
    weekdayWindowLabel: `${monthLabel(ym(startStr))} – ${monthLabel(ym(todayStr))}`,
    totalClientsEver: firstDate.size,
  }
}
