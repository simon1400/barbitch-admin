import {
  fetchMirrorBookingsRange,
  fetchMirrorEmployees,
  fetchSalonHoursRange,
  fetchTimeBlocksRange,
} from '../../../../lib/mirror'
import type {
  MirrorBooking,
  MirrorEmployee,
  MirrorSalonHour,
  MirrorTimeBlock,
} from '../../../../lib/mirror'

// Общий срез расписания за диапазон дат: мастера + часы салона + блокировки +
// брони. Ровно этот набор нужен и «Загрузке» (masterLoad), и «Окнам»
// (scheduleGaps) — раньше каждая вкладка тянула его сама, и переключение
// Load ↔ Gaps повторяло все четыре запроса заново (аудит s184, п. 3.2).
//
// Кэшируется ПРОМИС, а не результат: два одновременных вызова (вкладка «Окна»
// сама зовёт scheduleGaps изнутри дозаписи) дают один поход в сеть.

export interface TeamRangeData {
  employees: MirrorEmployee[]
  hours: MirrorSalonHour[]
  blocks: MirrorTimeBlock[]
  bookings: MirrorBooking[]
}

const TTL_MS = 5 * 60 * 1000

let cache: { key: string; ts: number; data: Promise<TeamRangeData> } | null = null

export const getTeamRangeData = (
  fromStr: string,
  toStr: string,
  force = false,
): Promise<TeamRangeData> => {
  const key = `${fromStr}|${toStr}`
  if (!force && cache && cache.key === key && Date.now() - cache.ts < TTL_MS) return cache.data

  const data = Promise.all([
    fetchMirrorEmployees(),
    fetchSalonHoursRange(fromStr, toStr),
    fetchTimeBlocksRange(fromStr, toStr),
    fetchMirrorBookingsRange(fromStr, toStr),
  ]).then(([employees, hours, blocks, bookings]) => ({ employees, hours, blocks, bookings }))

  const entry = { key, ts: Date.now(), data }
  cache = entry
  // Провал НЕ кэшируем: иначе одна сетевая ошибка залипла бы на пять минут и
  // кнопка «Обновить» показывала бы ту же ошибку, ничего не запрашивая.
  data.catch(() => {
    if (cache === entry) cache = null
  })
  return data
}

export const invalidateTeamRangeData = () => {
  cache = null
}
