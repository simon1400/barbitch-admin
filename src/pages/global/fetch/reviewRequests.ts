import { authHeaders } from '../../../lib/authHeaders'
// Data-слой журнала писем-просьб об отзыве (Strapi review-request-log, s175).
// В коллекции лежат имя и e-mail клиента, Public-прав у неё нет — запрос идёт
// с токеном сессии сотрудника (см. lib/authHeaders).
// Пишет в коллекцию только крон Strapi, админка её лишь читает.

const strapiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export interface ReviewRequestLog {
  id: number
  documentId: string
  clientName: string
  email: string
  visitDate: string
  visitCount: number
  serviceTitle: string
  employeeName: string
  sentAt: string
}

export interface ReviewRequestStats {
  total: number
  last7: number
  last30: number
  avgVisits: number | null
}

// Последние отправленные письма (по убыванию даты отправки).
export async function fetchReviewRequestLogs(limit = 100): Promise<ReviewRequestLog[]> {
  const res = await fetch(
    `${strapiUrl}/api/review-request-logs?sort=sentAt:desc&pagination[pageSize]=${limit}`,
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const json = await res.json()
  return Array.isArray(json?.data) ? json.data : []
}

// Сводка по уже загруженным записям — отдельных запросов не делаем.
export function statsFromLogs(logs: ReviewRequestLog[]): ReviewRequestStats {
  const now = Date.now()
  const since = (days: number) =>
    logs.filter((l) => l.sentAt && now - new Date(l.sentAt).getTime() <= days * 86400000).length
  const withVisits = logs.filter((l) => typeof l.visitCount === 'number' && l.visitCount > 0)
  return {
    total: logs.length,
    last7: since(7),
    last30: since(30),
    avgVisits: withVisits.length
      ? withVisits.reduce((s, l) => s + l.visitCount, 0) / withVisits.length
      : null,
  }
}
