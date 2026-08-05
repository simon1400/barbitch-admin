import { Axios } from '../../../../lib/api'
import { fetchAllPagesStrapi } from '../../../../lib/mirror'

// Автонапоминания «пора записаться снова» (comeback-reminder, крон 11:00 Праги).
// Лог отправок пишет ТОЛЬКО сервер (strapi api::comeback-reminder-log) — Public-прав
// у коллекции нет, читаем через fetchAllPagesStrapi (явный Bearer, см. lib/mirror.ts).
// Отписка клиента = поле client.reminderOptOut (его же проверяет сервис перед отправкой).

export interface ComebackLog {
  id: number
  documentId: string
  clientDocId: string
  clientName: string | null
  email: string | null
  lastVisitDate: string | null
  serviceTitle: string | null
  bookingDocId: string | null
  sentAt: string
}

export interface ClientBrief {
  documentId: string
  name: string
  email: string | null
  phone: string | null
  reminderOptOut?: boolean
}

interface ConvBooking {
  documentId: string
  date: string
  createdAt: string
  status: string
  client: { documentId: string } | null
}

export interface ComebackRow extends ComebackLog {
  optedOut: boolean
  /** бронь, созданная ПОСЛЕ письма (атрибуция конверсии, приблизительная) */
  bookedDate: string | null
  bookedAt: string | null
}

export interface ComebackDay {
  day: string // YYYY-MM-DD (Прага)
  sent: number
  converted: number
}

export interface ComebackReport {
  rows: ComebackRow[] // desc по sentAt
  byDay: ComebackDay[] // asc по дате
  optOuts: ClientBrief[]
  totals: {
    sent: number
    clients: number
    converted: number
    convRate: number // 0..100
    last7: number
    optOut: number
  }
}

const CLIENT_FIELDS =
  'fields[0]=name&fields[1]=email&fields[2]=phone&fields[3]=reminderOptOut'

/** День отправки в пражской зоне (sv-SE даёт формат YYYY-MM-DD). */
export const dayKeyPrague = (iso: string): string =>
  new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })

export const fmtDay = (d: string | null): string => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const fetchLogs = (): Promise<ComebackLog[]> =>
  fetchAllPagesStrapi<ComebackLog>('/api/comeback-reminder-logs?sort=sentAt:desc')

const fetchOptOuts = (): Promise<ClientBrief[]> =>
  fetchAllPagesStrapi<ClientBrief>(
    `/api/clients?filters[reminderOptOut][$eq]=true&${CLIENT_FIELDS}&sort=name:asc`,
  )

/** Брони, созданные начиная с fromIso (для атрибуции «записалась после письма»). */
const fetchBookingsCreatedSince = (fromIso: string): Promise<ConvBooking[]> =>
  fetchAllPagesStrapi<ConvBooking>(
    `/api/bookings?filters[createdAt][$gte]=${encodeURIComponent(fromIso)}` +
      `&filters[status][$in][0]=active&filters[status][$in][1]=checkedOut` +
      `&fields[0]=date&fields[1]=createdAt&fields[2]=status` +
      `&populate[client][fields][0]=name&sort=createdAt:asc`,
  )

let cache: { ts: number; data: ComebackReport } | null = null
const TTL_MS = 2 * 60 * 1000

export const getComebackReport = async (force = false): Promise<ComebackReport> => {
  if (!force && cache && Date.now() - cache.ts < TTL_MS) return cache.data

  const [logs, optOuts] = await Promise.all([fetchLogs(), fetchOptOuts()])

  // конверсии считаем только с самого раннего письма (раньше — не наша заслуга)
  let bookings: ConvBooking[] = []
  if (logs.length) {
    const minSent = logs.reduce((m, l) => (l.sentAt < m ? l.sentAt : m), logs[0].sentAt)
    bookings = await fetchBookingsCreatedSince(minSent)
  }

  const byClient = new Map<string, ConvBooking[]>()
  for (const b of bookings) {
    const key = b.client?.documentId
    if (!key) continue
    const arr = byClient.get(key)
    if (arr) arr.push(b)
    else byClient.set(key, [b])
  }

  const optOutSet = new Set(optOuts.map((c) => c.documentId))

  const rows: ComebackRow[] = logs.map((l) => {
    const sentDay = dayKeyPrague(l.sentAt)
    // бронь создана позже письма И визит не в прошлом относительно письма
    const hit = (byClient.get(l.clientDocId) || []).find(
      (b) => b.createdAt > l.sentAt && b.date >= sentDay,
    )
    return {
      ...l,
      optedOut: optOutSet.has(l.clientDocId),
      bookedDate: hit?.date ?? null,
      bookedAt: hit?.createdAt ?? null,
    }
  })

  const dayMap = new Map<string, ComebackDay>()
  for (const r of rows) {
    const day = dayKeyPrague(r.sentAt)
    const cur = dayMap.get(day) || { day, sent: 0, converted: 0 }
    cur.sent += 1
    if (r.bookedDate) cur.converted += 1
    dayMap.set(day, cur)
  }
  const byDay = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day))

  const uniqueClients = new Set(rows.map((r) => r.clientDocId))
  const convertedClients = new Set(rows.filter((r) => r.bookedDate).map((r) => r.clientDocId))
  const weekAgo = Date.now() - 7 * 86400000
  const last7 = rows.filter((r) => new Date(r.sentAt).getTime() >= weekAgo).length

  const data: ComebackReport = {
    rows,
    byDay,
    optOuts,
    totals: {
      sent: rows.length,
      clients: uniqueClients.size,
      converted: convertedClients.size,
      convRate: uniqueClients.size
        ? Math.round((convertedClients.size / uniqueClients.size) * 1000) / 10
        : 0,
      last7,
      optOut: optOuts.length,
    },
  }

  cache = { ts: Date.now(), data }
  return data
}

export const invalidateComebackReport = (): void => {
  cache = null
}

/** Поиск клиента по e-mail или имени (для ручной отписки). */
export const searchClientsForOptOut = async (q: string): Promise<ClientBrief[]> => {
  const query = q.trim()
  if (query.length < 3) return []
  const enc = encodeURIComponent(query)
  return fetchAllPagesStrapi<ClientBrief>(
    `/api/clients?filters[$or][0][email][$containsi]=${enc}` +
      `&filters[$or][1][name][$containsi]=${enc}` +
      `&${CLIENT_FIELDS}&sort=name:asc`,
    50,
  )
}

/** Ставит/снимает отписку. Мутация идёт через Axios — интерсептор подставляет токен. */
export const setReminderOptOut = async (clientDocId: string, optOut: boolean): Promise<void> => {
  await Axios.put(`/api/clients/${clientDocId}`, { data: { reminderOptOut: optOut } })
  invalidateComebackReport()
}
