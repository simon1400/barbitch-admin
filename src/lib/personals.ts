// Активные мастера из НАШЕЙ базы (коллекция personal) — один загрузчик на
// календарь и на аналитику (этап 5.4 аудита, s189).
//
// До этого один и тот же запрос был расписан дважды — в lib/mirror и в
// pages/calendar/fetch/calendarDay — вместе с формой сырой записи, отсевом
// («❌» в имени и мастера без noonaEmployeeId) и нормализацией тира. Разошлись
// они только полями и порядком сортировки, то есть расходиться могли и молча:
// отсев, заведённый в одном месте, во втором бы не появился.
//
// ⚠️ Сведены ИМЕННО эти два. Остальные четыре обращения к `/api/personals`
// (зарплаты мастера, каталог услуг, приоритет записи, налоги) — РАЗНЫЕ запросы:
// другие фильтры, другие поля, свои populate (`services`, `rates`) и своя форма
// ответа. Сводить их в один загрузчик значило бы возить каждому экрану лишнее.
import { Axios } from './api'
import { authHeaders } from './authHeaders'

/** Мастер календаря/аналитики. Ключ `id` — noonaEmployeeId (стабильный id сотрудника). */
export interface ActivePersonal {
  id: string
  docId: string // personal.documentId — для write-операций движка
  name: string
  tier: 'senior' | 'junior'
  calendarOrder: number
  /** процент мастера от цены услуги (его доля показывается в календаре мастера) */
  ratePercent: number | null
}

interface RawPersonal {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  tier: 'senior' | 'junior' | null
  calendarOrder: number | null
  ratePercent: number | null
}

// `status=published` избыточен (Strapi 5 и без него отдаёт только published), но
// оставлен явным — так у запроса читается намерение. Поле `position` прежний
// календарный запрос тянул и НЕ читал: убрано.
const QUERY =
  '/api/personals?filters[isActive][$eq]=true' +
  '&fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=tier' +
  '&fields[3]=calendarOrder&fields[4]=ratePercent' +
  '&pagination[pageSize]=100&status=published'

/**
 * Активные мастера, порядок — как в календаре: personal.calendarOrder (меньше
 * левее), при равенстве алфавит по-чешски.
 *
 * ⚠️ Отсев здесь ДВОЙНОЙ и снимать его нельзя: запрос уже режет по isActive, а
 * дальше выкидываются записи без noonaEmployeeId (по нему сходятся брони) и
 * служебные строки с «❌» в имени.
 */
export const fetchActivePersonals = async (): Promise<ActivePersonal[]> => {
  const res = (await Axios.get(QUERY, { headers: authHeaders() })) as RawPersonal[]
  return (res || [])
    .filter((p) => p.noonaEmployeeId && !p.name.startsWith('❌'))
    .map((p) => ({
      id: p.noonaEmployeeId as string,
      docId: p.documentId,
      name: p.name.trim(),
      tier: p.tier === 'junior' ? ('junior' as const) : ('senior' as const),
      calendarOrder: p.calendarOrder ?? 0,
      ratePercent: p.ratePercent ?? null,
    }))
    .sort((a, b) => a.calendarOrder - b.calendarOrder || a.name.localeCompare(b.name, 'cs'))
}

/** Получатель интерной услуги (s203): любой активный сотрудник салона. */
export interface InternalRecipient {
  docId: string
  name: string
  /** 'master' | 'administrator' — показывается подписью в селекторе */
  position: string | null
}

// 🟥 Это ОТДЕЛЬНЫЙ запрос, а не переиспользование fetchActivePersonals, и свести их нельзя:
// тот выкидывает сотрудников без `noonaEmployeeId`, потому что по нему сходятся БРОНИ.
// Получатель интерной услуги брони не исполняет — у администраторов noonaEmployeeId
// может не быть вовсе, и они бы молча пропали из списка. Отсев «❌» остаётся.
const RECIPIENTS_QUERY =
  '/api/personals?filters[isActive][$eq]=true' +
  '&fields[0]=name&fields[1]=position' +
  '&pagination[pageSize]=100&status=published'

export const fetchInternalRecipients = async (): Promise<InternalRecipient[]> => {
  const res = (await Axios.get(RECIPIENTS_QUERY, { headers: authHeaders() })) as {
    documentId: string
    name: string
    position: string | null
  }[]
  return (res || [])
    .filter((p) => p.name && !p.name.startsWith('❌'))
    .map((p) => ({ docId: p.documentId, name: p.name.trim(), position: p.position ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
}
