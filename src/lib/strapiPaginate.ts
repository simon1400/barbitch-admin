// Постраничный сбор коллекции через Axios-инстанс админки (этап 4.2 аудита, s185).
//
// 🟥 Почему цикл «пока страница полная», а не подсчёт по meta.pagination:
// интерсептор в lib/api.ts возвращает `response.data.data`, то есть meta до
// вызывающего кода не доходит. Признак конца — короткая страница. Там, где нужен
// параллельный сбор по pageCount, используется чистый fetch из lib/strapiRest.ts.
//
// Ровно отсутствие этого хелпера породило `pageSize: 40` на денежных выборках:
// 41-я строка молча выпадала из «Результата месяца» (s182).
import { Axios } from './api'

// Потолок страницы = `api.rest.maxLimit` в strapi/config/api.ts. Просить больше
// бессмысленно: сервер молча урежет ответ до 500, и часть денег потеряется без
// единой ошибки в консоли.
export const PAGE_SIZE = 500

export interface PaginateOptions {
  /** Размер страницы. ДОЛЖЕН совпадать с pageSize внутри buildPageQuery. */
  pageSize?: number
  /** Предохранитель от бесконечного цикла. */
  maxPages?: number
  /**
   * Сбой запроса страницы. Вернуть 'retry' — повторить ТУ ЖЕ страницу (например,
   * пересобрав запрос без поля, которого нет на старом деплое Strapi). Бросить —
   * прервать сбор. По умолчанию ошибка уходит наверх: неполная выборка на денежных
   * и рассылочных путях опаснее явного отказа.
   */
  onPageError?: (error: unknown, page: number) => 'retry' | void
}

export const fetchAllPagesAxios = async <T>(
  endpoint: string,
  buildPageQuery: (page: number) => string,
  { pageSize = PAGE_SIZE, maxPages = 40, onPageError }: PaginateOptions = {},
): Promise<T[]> => {
  const out: T[] = []
  let page = 1
  let guard = 0

  // guard считает ИТЕРАЦИИ, а не номер страницы: повтор по 'retry' не должен
  // тратить лимит страниц, но и зациклиться навсегда тоже не должен.
  while (page <= maxPages && guard < maxPages * 3) {
    guard++
    let rows: unknown
    try {
      rows = await Axios.get<T[]>(`${endpoint}?${buildPageQuery(page)}`)
    } catch (e) {
      if (onPageError?.(e, page) === 'retry') continue
      throw e
    }
    const arr = Array.isArray(rows) ? (rows as T[]) : []
    out.push(...arr)
    if (arr.length < pageSize) return out
    if (page === maxPages) {
      // предохранитель: лучше шумная ошибка, чем тихо срезанные деньги
      console.error(`fetchAllPages: ${endpoint} отдал ${maxPages} полных страниц — выборка обрезана`)
    }
    page++
  }
  return out
}
