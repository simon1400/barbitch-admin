import { NoonaHQ } from '../../../../lib/noona'

// Общий кэш ВСЕЙ истории событий Noona с ценами — используется табами
// «Спящие», «Возвращаемость», «Прогноз», «Отмены». Один fetch на 5 минут.
// Текущий год тянется до 1 января следующего → БУДУЩИЕ брони тоже в кэше
// (нужно прогнозу и фильтру «у клиента есть будущая запись»).

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string
const HISTORY_START_YEAR = 2024 // салон открылся в ноябре 2024

interface RawEvent {
  customer?: string
  customer_name?: string
  employee?: string
  status?: string
  event_date?: string
  starts_at?: string
  ends_at?: string
  created_at?: string
  event_types?: Array<{ price?: { amount?: number } }>
}

export interface HistEvent {
  customer: string
  customerName: string
  employee: string
  status: string
  date: string // 'YYYY-MM-DD'
  startsAt: string
  endsAt: string
  createdAt: string // ISO timestamp брони (когда создана) — для атрибуции дозаписей
  price: number
  durationMin: number
}

const SELECT_FIELDS = [
  'customer',
  'customer_name',
  'employee',
  'status',
  'event_date',
  'starts_at',
  'ends_at',
  'created_at',
  'event_types.price',
]

const fetchYear = async (year: number): Promise<RawEvent[]> => {
  const params = new URLSearchParams()
  params.append(
    'filter',
    JSON.stringify({
      from: `${year}-01-01T00:00:00.000Z`,
      to: `${year + 1}-01-01T00:00:00.000Z`,
    }),
  )
  for (const f of SELECT_FIELDS) params.append('select', f)
  const res = await NoonaHQ.get<RawEvent[]>(`/${COMPANY_ID}/events?${params.toString()}`)
  return Array.isArray(res.data) ? res.data : []
}

const toHist = (e: RawEvent): HistEvent | null => {
  if (!e.event_date) return null
  let durationMin = 0
  if (e.starts_at && e.ends_at) {
    durationMin = Math.max(
      0,
      (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000,
    )
  }
  return {
    customer: e.customer ?? '',
    customerName: e.customer_name ?? '',
    employee: e.employee ?? '',
    status: e.status ?? '',
    date: e.event_date,
    startsAt: e.starts_at ?? '',
    endsAt: e.ends_at ?? '',
    createdAt: e.created_at ?? '',
    price: e.event_types?.[0]?.price?.amount ?? 0,
    durationMin,
  }
}

let cache: { ts: number; events: HistEvent[] } | null = null
const CACHE_TTL = 5 * 60 * 1000

export const getEventsHistory = async (force = false): Promise<HistEvent[]> => {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache.events
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = HISTORY_START_YEAR; y <= currentYear; y++) years.push(y)
  const chunks = await Promise.all(years.map((y) => fetchYear(y)))
  const events = chunks.flat().map(toHist).filter(Boolean) as HistEvent[]
  cache = { ts: Date.now(), events }
  return events
}

// «Состоявшийся визит» — не отменён и не no-show
export const isAttended = (e: HistEvent) => e.status !== 'cancelled' && e.status !== 'noshow'
// Активная бронь (для будущего): просто не отменена
export const isActive = (e: HistEvent) => e.status !== 'cancelled'

export const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// Имена ВСЕХ сотрудников (включая удалённых) — для атрибуции исторических событий
let empCache: Map<string, string> | null = null
export const fetchEmployeeNames = async (): Promise<Map<string, string>> => {
  if (empCache) return empCache
  const res = await NoonaHQ.get(`/${COMPANY_ID}/employees?select=id&select=name`)
  const items: Array<{ id?: string; name?: string }> = Array.isArray(res.data) ? res.data : []
  empCache = new Map(items.filter((e) => e.id).map((e) => [e.id!, (e.name ?? e.id!).trim()]))
  return empCache
}
