// Общий data-слой ЗЕРКАЛА (собственные коллекции Strapi: booking / client /
// salon-hour / time-block / personal) для аналитики и дашбордов admin-апки.
// Заменяет прямые обращения к Noona API (own-booking фаза 4).
//
// Чистый fetch (НЕ Axios из lib/api): его интерсептор разворачивает res.data.data
// и теряет meta.pagination, а на мутациях подменяет Authorization. Все GET с явным
// Bearer strapi-токеном (booking/client содержат PII — Public-права не включаем).

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

interface StrapiListResponse<T> {
  data: T[]
  meta?: { pagination?: { pageCount?: number; total?: number } }
}

const getJson = async <T>(pathWithQuery: string): Promise<StrapiListResponse<T>> => {
  const res = await fetch(`${API_URL}${pathWithQuery}`, {
    headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined,
  })
  if (!res.ok) throw new Error(`Strapi GET ${pathWithQuery} → ${res.status}`)
  return res.json()
}

// Параллельная пагинация: 1-я страница даёт pageCount → остальные одним залпом
export const fetchAllPagesStrapi = async <T>(path: string, pageSize = 500): Promise<T[]> => {
  const sep = path.includes('?') ? '&' : '?'
  const page = (n: number) =>
    getJson<T>(`${path}${sep}pagination[page]=${n}&pagination[pageSize]=${pageSize}&pagination[withCount]=true`)
  const first = await page(1)
  const out = [...(first.data || [])]
  const pageCount = first.meta?.pagination?.pageCount || 1
  if (pageCount > 1) {
    const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => page(i + 2)))
    for (const r of rest) out.push(...(r.data || []))
  }
  return out
}

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
  status: 'active' | 'checkedOut' | 'cancelled' | 'noshow'
  services: Array<{ title?: string; price?: number | null; durationMin?: number | null }> | null
  totalPrice: number | string | null
  origin: string | null
  bsChannel: string | null
  noonaCreatedAt: string | null
  createdAt: string
  client: { documentId: string; name: string; noonaCustomerId: string | null } | null
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
]
  .map((f, i) => `fields[${i}]=${f}`)
  .join('&')

const CLIENT_POPULATE =
  'populate[client][fields][0]=name&populate[client][fields][1]=noonaCustomerId'

/** ВСЯ история броней (с клиентом) — фундамент кэша аналитики. */
export const fetchMirrorBookingsAll = (): Promise<MirrorBooking[]> =>
  fetchAllPagesStrapi<MirrorBooking>(`/api/bookings?${BOOKING_FIELDS}&${CLIENT_POPULATE}&sort=date:asc`)

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

// ── клиенты ──

export interface MirrorClient {
  documentId: string
  name: string
  phone: string | null
  email: string | null
  noonaCustomerId: string | null
  blacklisted: boolean
}

export const fetchMirrorClients = (): Promise<MirrorClient[]> =>
  fetchAllPagesStrapi<MirrorClient>(
    `/api/clients?fields[0]=name&fields[1]=phone&fields[2]=email&fields[3]=noonaCustomerId&fields[4]=blacklisted`,
  )

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

interface RawPersonal {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  tier: string | null
}

/** Активные мастера из НАШЕЙ базы (personal, published, isActive). */
export const fetchMirrorEmployees = async (): Promise<MirrorEmployee[]> => {
  const res = await getJson<RawPersonal>(
    `/api/personals?filters[isActive][$eq]=true&fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=tier&pagination[pageSize]=100&status=published`,
  )
  return (res.data || [])
    .filter((p) => p.noonaEmployeeId && !p.name.startsWith('❌'))
    .map((p) => ({
      id: p.noonaEmployeeId as string,
      docId: p.documentId,
      name: p.name.trim(),
      tier: p.tier === 'junior' ? ('junior' as const) : ('senior' as const),
    }))
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

export const fetchTimeBlocksRange = (fromStr: string, toStr: string): Promise<MirrorTimeBlock[]> =>
  fetchAllPagesStrapi<MirrorTimeBlock>(
    `/api/time-blocks?filters[date][$gte]=${fromStr}&filters[date][$lte]=${toStr}`,
  )
