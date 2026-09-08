// Единый «сырой» слой обращений к REST Strapi (этап 4.2 аудита, s185).
//
// 🟥 Почему не Axios из lib/api: его интерсептор возвращает `response.data.data`,
// то есть срезает `meta.pagination`. Без счётчика страниц пагинация превращается
// в последовательный цикл «пока страница полная», а параллельно забрать хвост
// нельзя. Здесь чистый fetch — `meta` доезжает целиком.
//
// Авторизация — токен сессии сотрудника (lib/authHeaders): коллекции с PII
// (booking / client / лояльность) для роли Public закрыты.
//
// До s185 этот код был скопирован ДОСЛОВНО в lib/mirror.ts и в
// pages/global/fetch/loyalty.ts — вместе с типом ответа и обоими хелперами.
import { API_URL } from './config'
import { authHeaders } from './authHeaders'

export interface StrapiListResponse<T> {
  data: T[]
  meta?: { pagination?: { pageCount?: number; total?: number } }
}

export const getJson = async <T>(pathWithQuery: string): Promise<StrapiListResponse<T>> => {
  const res = await fetch(`${API_URL}${pathWithQuery}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Strapi GET ${pathWithQuery} → ${res.status}`)
  return res.json()
}

export const sendJson = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strapi ${method} ${path} → ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.status === 204 ? null : res.json()
}

// Параллельная пагинация: 1-я страница даёт pageCount → остальные одним залпом.
// `withCount=true` обязателен — без него Strapi не кладёт pageCount в meta,
// и хвост выборки молча потерялся бы.
export const fetchAllPagesStrapi = async <T>(path: string, pageSize = 500): Promise<T[]> => {
  const sep = path.includes('?') ? '&' : '?'
  const page = (n: number) =>
    getJson<T>(
      `${path}${sep}pagination[page]=${n}&pagination[pageSize]=${pageSize}&pagination[withCount]=true`,
    )
  const first = await page(1)
  const out = [...(first.data || [])]
  const pageCount = first.meta?.pagination?.pageCount || 1
  if (pageCount > 1) {
    const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => page(i + 2)))
    for (const r of rest) out.push(...(r.data || []))
  }
  return out
}
