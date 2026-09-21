import { API_URL } from './config'
import { authHeaders } from './authHeaders'
import { fetchAllPagesStrapi, getJson } from './strapiRest'
import { fetchActivePersonals } from './personals'
import type { BookingStatus } from './bookingStatus'
// Общий data-слой ЗЕРКАЛА (собственные коллекции Strapi: booking / client /
// salon-hour / time-block / personal) для аналитики и дашбордов admin-апки.
// Заменяет прямые обращения к Noona API (own-booking фаза 4).
//
// Сырой слой (fetch + пагинация по pageCount) — общий: lib/strapiRest.ts.

// ── брони (зеркало Noona events + записи собственного движка) ──

export interface MirrorBooking {
  id: number
  documentId: string
  clientNameRaw: string
  employeeNameRaw: string
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
  status: BookingStatus
  services: Array<{ title?: string; price?: number | null; durationMin?: number | null }> | null
  totalPrice: number | string | null
  origin: string | null
  bsChannel: string | null
  noonaCreatedAt: string | null
  createdAt: string
  client: { documentId: string; name: string; noonaCustomerId: string | null } | null
  // интерная бронь (s203): NULL/undefined у старых строк = обычная
  internal?: boolean | null
}

const BOOKING_FIELDS = [
  'clientNameRaw',
  'employeeNameRaw',
  'noonaEmployeeId',
  'date',
  'startsAt',
  'endsAt',
  'status',
  'services',
  'totalPrice',
  'origin',
  'bsChannel',
  'noonaCreatedAt',
  'createdAt',
  'internal',
]
  .map((f, i) => `fields[${i}]=${f}`)
  .join('&')

const CLIENT_POPULATE =
  'populate[client][fields][0]=name&populate[client][fields][1]=noonaCustomerId'

/** Брони диапазона дат (включительно). extra — доп. query-фрагмент. */
export const fetchMirrorBookingsRange = (
  fromStr: string,
  toStr: string,
  extra = '',
): Promise<MirrorBooking[]> =>
  fetchAllPagesStrapi<MirrorBooking>(
    `/api/bookings?filters[date][$gte]=${fromStr}&filters[date][$lte]=${toStr}&${BOOKING_FIELDS}&${CLIENT_POPULATE}${extra}`,
  )

/** Кол-во броней, СОЗДАННЫХ в интервале (noonaCreatedAt зеркала; свои — createdAt). */
export const countBookingsCreatedBetween = async (fromIso: string, toIso: string): Promise<number> => {
  const q =
    `/api/bookings?filters[$or][0][noonaCreatedAt][$gte]=${encodeURIComponent(fromIso)}` +
    `&filters[$or][0][noonaCreatedAt][$lte]=${encodeURIComponent(toIso)}` +
    `&filters[$or][1][noonaCreatedAt][$null]=true` +
    `&filters[$or][1][createdAt][$gte]=${encodeURIComponent(fromIso)}` +
    `&filters[$or][1][createdAt][$lte]=${encodeURIComponent(toIso)}` +
    `&fields[0]=id&pagination[pageSize]=1&pagination[withCount]=true`
  const res = await getJson<unknown>(q)
  return res.meta?.pagination?.total || 0
}

// ── сжатые выгрузки движка (аналитика) ──
//
// Вся история броней и весь список клиентов раньше собирались тут постранично
// из `/api/bookings` и `/api/clients` — ~10 и ~4 запроса, ~2.9 МБ и ~370 КБ JSON.
// Теперь проекция делается на сервере, а сюда приходит колоночный массив одним
// ответом (strapi/src/api/booking-engine/services/admin-analytics.ts).

const getEngine = async <T>(pathWithQuery: string): Promise<T> => {
  const res = await fetch(`${API_URL}${pathWithQuery}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Strapi GET ${pathWithQuery} → ${res.status}`)
  return res.json() as Promise<T>
}

/** Ответ `/engine/admin/analytics/history`. Порядок колонок задаёт сервер. */
export interface CompactHistory {
  cols: string[]
  events: Array<Array<string | number>>
  empNames: Array<[string, string]>
}

export const fetchAnalyticsHistory = (): Promise<CompactHistory> =>
  getEngine<CompactHistory>('/api/engine/admin/analytics/history')

// ── клиенты ──

/** Клиент в аналитике. `customer` — уже готовый стабильный ключ (clientKey с сервера). */
export interface MirrorClient {
  customer: string
  name: string
  phone: string
  email: string
}

interface CompactClients {
  cols: string[]
  clients: string[][]
}

export const fetchMirrorClients = async (): Promise<MirrorClient[]> => {
  const res = await getEngine<CompactClients>('/api/engine/admin/analytics/clients')
  return (res.clients || []).map((r) => ({
    customer: r[0] ?? '',
    name: r[1] ?? '',
    phone: r[2] ?? '',
    email: r[3] ?? '',
  }))
}

/** Только «ключ → имя»: контакты почти двух тысяч клиентов там, где нужны имена, лишние. */
export const fetchMirrorClientNames = async (): Promise<Map<string, string>> => {
  const res = await getEngine<CompactClients>('/api/engine/admin/analytics/clients?contacts=0')
  const map = new Map<string, string>()
  for (const r of res.clients || []) {
    if (r[0] && r[1]) map.set(r[0], r[1])
  }
  return map
}

/** Стабильный id клиента в аналитике: noonaCustomerId (историческая совместимость
 * с email-campaign-log) или documentId для клиентов, созданных уже нашим движком. */
export const clientKey = (c: { noonaCustomerId?: string | null; documentId: string }): string =>
  c.noonaCustomerId || c.documentId

// ── мастера ──

export interface MirrorEmployee {
  id: string // noonaEmployeeId — стабильный ключ в зеркальных данных
  docId: string
  name: string
  tier: 'senior' | 'junior'
}

/**
 * Активные мастера из НАШЕЙ базы (personal, published, isActive).
 *
 * ⚠️ Порядок ЗДЕСЬ по имени, а не по calendarOrder, и это не мелочь: строки
 * «Загрузки», «Окон» и таблиц аналитики выводятся в порядке этого списка.
 */
export const fetchMirrorEmployees = async (): Promise<MirrorEmployee[]> => {
  const all = await fetchActivePersonals()
  return all
    .map(({ id, docId, name, tier }) => ({ id, docId, name, tier }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
}

// ── расписание (salon-hour / time-block) ──

export interface MirrorSalonHour {
  date: string
  openMin: number | null
  closeMin: number | null
  windows: Array<{ starts_at?: string; ends_at?: string }> | null
}

export const fetchSalonHoursRange = (fromStr: string, toStr: string): Promise<MirrorSalonHour[]> =>
  fetchAllPagesStrapi<MirrorSalonHour>(
    `/api/salon-hours?filters[date][$gte]=${fromStr}&filters[date][$lte]=${toStr}`,
  )

export interface MirrorTimeBlock {
  documentId: string
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
  title: string | null
  noonaKey: string | null
}

// Только подтверждённые блоки (approved) + легаси/зеркальные без поля (NULL):
// блок администратора, ждущий подтверждения владельца, время ещё не занимает.
export const fetchTimeBlocksRange = (fromStr: string, toStr: string): Promise<MirrorTimeBlock[]> =>
  fetchAllPagesStrapi<MirrorTimeBlock>(
    `/api/time-blocks?filters[date][$gte]=${fromStr}&filters[date][$lte]=${toStr}` +
      '&filters[$or][0][approvalStatus][$null]=true&filters[$or][1][approvalStatus][$eq]=approved',
  )
