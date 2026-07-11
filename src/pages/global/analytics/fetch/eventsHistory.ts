import { clientKey, fetchMirrorBookingsAll, fetchMirrorEmployees } from '../../../../lib/mirror'
import type { MirrorBooking } from '../../../../lib/mirror'

// Общий кэш ВСЕЙ истории броней — используется табами «Спящие», «Возвращаемость»,
// «Прогноз», «Отмены», «Клиенты», результатами кампаний/дозаписей. Один fetch на 5 минут.
//
// own-booking фаза 4: источник — НАША БД (коллекция booking: зеркало Noona + записи
// собственного движка), Noona API здесь больше не участвует. Интерфейс HistEvent
// сохранён 1:1 — потребители не менялись. Бонусы против Noona-версии:
//   - customerName = ТЕКУЩЕЕ имя клиента (relation), а не снимок на момент брони (боль s97);
//   - customer = noonaCustomerId (совместимость с историей email-campaign-log) или
//     documentId для клиентов, созданных уже нашим движком;
//   - будущие брони в кэше автоматически (зеркало живёт по синку, без «до 1 января»).

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

const toHist = (b: MirrorBooking): HistEvent | null => {
  if (!b.date) return null
  let durationMin = 0
  if (b.startsAt && b.endsAt) {
    durationMin = Math.max(0, (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000)
  }
  return {
    customer: b.client ? clientKey(b.client) : '',
    customerName: b.client?.name || b.clientNameRaw || '',
    employee: b.noonaEmployeeId ?? '',
    status: b.status ?? '',
    date: String(b.date),
    startsAt: b.startsAt ?? '',
    endsAt: b.endsAt ?? '',
    createdAt: b.noonaCreatedAt || b.createdAt || '',
    price: Number(b.totalPrice) || 0,
    durationMin,
  }
}

let cache: { ts: number; events: HistEvent[]; empNames: Map<string, string> } | null = null
const CACHE_TTL = 5 * 60 * 1000

const loadHistory = async (force: boolean) => {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache
  const [bookings, employees] = await Promise.all([
    fetchMirrorBookingsAll(),
    fetchMirrorEmployees().catch(() => []),
  ])
  const events = bookings.map(toHist).filter(Boolean) as HistEvent[]
  // Имена мастеров: базово — снимки из броней (покрывают и бывших сотрудников),
  // поверх — полные актуальные имена активных из personal
  const empNames = new Map<string, string>()
  for (const b of bookings) {
    if (b.noonaEmployeeId && b.employeeNameRaw) empNames.set(b.noonaEmployeeId, b.employeeNameRaw.trim())
  }
  for (const e of employees) empNames.set(e.id, e.name)
  cache = { ts: Date.now(), events, empNames }
  return cache
}

export const getEventsHistory = async (force = false): Promise<HistEvent[]> =>
  (await loadHistory(force)).events

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

// Имена ВСЕХ сотрудников (включая бывших) — для атрибуции исторических событий
export const fetchEmployeeNames = async (): Promise<Map<string, string>> =>
  (await loadHistory(false)).empNames
