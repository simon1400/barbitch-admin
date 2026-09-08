// Обращения к НАШИМ серверным ручкам (движок брони, слияние дублей и т.п.),
// которые отвечают своим форматом `{ error: { code } }` (этап 4.2 аудита, s185).
//
// 🟥 Почему не Axios из lib/api: его интерсептор возвращает `response.data.data`,
// а у этих ручек ответ — не обёртка Strapi. Плюс он подменял бы Authorization.
//
// До s185 тело этой функции было продублировано в calendar/fetch/engineApi.ts
// и в global/fetch/clientDedupe.ts — отличались только префикс пути, словарь
// сообщений и язык запасной фразы.
import { API_URL } from './config'
import { getToken } from '../services/auth'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * Собирает функцию запроса к ручкам под общим префиксом.
 * @param prefix путь до группы ручек, например `/api` или `/api/client-dedupe`
 * @param codeMessages code из ответа сервера → человеческий текст
 * @param fallback текст, когда code неизвестен и сервер не прислал message
 */
export const makeApiFetch =
  (prefix: string, codeMessages: Record<string, string>, fallback: (status: number) => string) =>
  async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${prefix}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const code = json?.error?.code || 'internal'
      throw new ApiError(res.status, code, codeMessages[code] || json?.error?.message || fallback(res.status))
    }
    return json as T
  }
