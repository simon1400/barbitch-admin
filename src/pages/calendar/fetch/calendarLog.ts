// Журнал действий календаря — чтение коллекции calendar-log (записи создаёт движок
// booking-engine при admin-операциях). Plain fetch с явным Bearer strapi-токеном
// (как lib/mirror.ts): интерсептор Axios теряет meta.pagination и подменяет auth;
// лог содержит имена клиентов → Public-права не включаем, читаем под токеном.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

export interface CalendarLog {
  id: number
  documentId: string
  action: string
  entityType: string | null
  actorName: string | null
  entityDocId: string | null
  clientName: string | null
  employeeName: string | null
  summary: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export interface CalendarLogPage {
  rows: CalendarLog[]
  pageCount: number
  total: number
}

export const fetchCalendarLogs = async ({
  page = 1,
  pageSize = 60,
  entityType,
  actor,
}: {
  page?: number
  pageSize?: number
  entityType?: 'booking' | 'block'
  actor?: string
}): Promise<CalendarLogPage> => {
  const params = new URLSearchParams()
  params.set('sort', 'createdAt:desc')
  params.set('pagination[page]', String(page))
  params.set('pagination[pageSize]', String(pageSize))
  params.set('pagination[withCount]', 'true')
  if (entityType) params.set('filters[entityType][$eq]', entityType)
  if (actor && actor.trim()) params.set('filters[actorName][$containsi]', actor.trim())

  const res = await fetch(`${API_URL}/api/calendar-logs?${params.toString()}`, {
    headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined,
  })
  if (!res.ok) throw new Error(`calendar-logs → ${res.status}`)
  const json = await res.json()
  return {
    rows: (json.data || []) as CalendarLog[],
    pageCount: json.meta?.pagination?.pageCount || 1,
    total: json.meta?.pagination?.total || 0,
  }
}
