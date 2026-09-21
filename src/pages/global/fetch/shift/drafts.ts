/* eslint-disable @typescript-eslint/no-explicit-any */
// Выборки одного дня для сверки смены: черновики коллекций, оказанные услуги,
// брони календаря, текущие имена клиентов и месячная запись card-profit.
// Вынесено из fetch/shiftClose.ts ДОСЛОВНО (этап 6 аудита).
import { Axios } from '../../../../lib/api'
import { authHeaders } from '../../../../lib/authHeaders'
import { isAttendedStatus } from '../../../../lib/bookingStatus'
import { clientKey, fetchMirrorBookingsRange, fetchMirrorClientNames } from '../../../../lib/mirror'
import { type VerifyFlag } from '../../../../lib/verifyFlags'
import { monthEndYmd } from '../../../../utils/date'
import { getItemFlags } from './flags'

// 🟥 Без токена Strapi санитизирует populate по правам роли Public, а у коллекции
// `booking` их нет (PII) → `populate=*` МОЛЧА выкидывает relation booking из ответа.
// Записи чекаута из календаря выглядели непривязанными: янтарный «—» в колонке
// услуги и pre-flight «offer/booking: chybí vazba», блокирующий закрытие смены.
// Явный Bearer на запросах services-provided сохраняет booking в ответе.
export const authCfg = () => ({ headers: authHeaders() })

// Короткое человекочитаемое описание сбоя выборки (HTTP-код или текст).
const errText = (e: any): string => {
  const status = e?.response?.status
  if (status) return `HTTP ${status}`
  return e?.message ? String(e.message) : 'neznámá chyba'
}

// Черновики одной коллекции за конкретный день. Три выборки сверки (касса,
// рабочее время, выплаты) отличались ТОЛЬКО адресом и чешской подписью ошибки —
// сам запрос, разбор ответа и обработка сбоя были расписаны трижды дословно.
//
// ⚠️ Подпись ошибки обязательна и у каждой своя: страница показывает её списком
// и по ней блокирует кнопку «Uzavřít směnu». Общего текста тут быть не может —
// владелец должен видеть, ИМЕННО КАКАЯ выборка не доехала.
export const fetchDayDraftsOf = async (endpoint: string, label: string, dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/${endpoint}?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    return { found: items.length > 0, count: items.length, items }
  } catch (e) {
    console.error(`fetch ${endpoint} error:`, e)
    return { found: false, count: 0, items: [], error: `${label}: ${errText(e)}` }
  }
}

// Комиссии администраторов за дозаписи (s197): черновики «Доп. заработка» дня с
// source=upsell. Статус визита нужен сразу — по нему решается, что публикуется.
// Ручные записи владельца (без source) сюда не попадают: закрытие их не трогает.
export const upsellCommissionsUrl = (dateStr: string) =>
  `/api/add-moneys?filters[date][$eq]=${dateStr}&filters[source][$eq]=upsell` +
  '&populate[personal][fields][0]=name' +
  '&populate[booking][fields][0]=status&populate[booking][fields][1]=clientNameRaw' +
  '&populate[booking][fields][2]=employeeNameRaw&populate[booking][fields][3]=services' +
  // date + startsAt — для колонки «Čas» и ссылки в календарь на саму бронь
  '&populate[booking][fields][4]=date&populate[booking][fields][5]=startsAt' +
  '&pagination[pageSize]=100&status=draft'

export const fetchUpsellCommissions = async (dateStr: string) => {
  try {
    const res = await Axios.get(upsellCommissionsUrl(dateStr), authCfg())
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    return { found: items.length > 0, count: items.length, items }
  } catch (e) {
    console.error('fetchUpsellCommissions error:', e)
    return { found: false, count: 0, items: [], error: `provize za dozápisy: ${errText(e)}` }
  }
}

// Fetch service-provided records for a specific date
export const fetchServiceProvided = async (dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/services-provided?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
      authCfg(),
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    // Counters are per-flag (one item with multiple flags is counted in each)
    const flagCounts: Record<VerifyFlag, number> = {
      ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0, internal: 0, sleva_bez_karty: 0, cena_rucne: 0,
    }
    let unverified = 0
    for (const i of items as any[]) {
      const flags = getItemFlags(i)
      if (flags.length === 0) {
        unverified++
        continue
      }
      for (const f of flags) flagCounts[f]++
    }
    return { found: items.length > 0, count: items.length, flagCounts, unverified, items }
  } catch (e) {
    console.error('fetchServiceProvided error:', e)
    return {
      found: false,
      count: 0,
      flagCounts: { ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0, internal: 0, sleva_bez_karty: 0, cena_rucne: 0 },
      unverified: 0,
      items: [],
      error: `provedené služby: ${errText(e)}`,
    }
  }
}

// Брони дня из НАШЕГО календаря (booking-коллекция) для сверки со
// services-provided. Форма событий историческая (customer_name /
// event_types[0].title / employee.name) — вся логика сверки (diffByName,
// buildOfferMatches) на неё завязана. customer_name
// берётся ТЕКУЩИЙ (client relation) — устаревших снимков имён нет по построению.
export const fetchCalendarBookings = async (dateStr: string) => {
  try {
    const bookings = await fetchMirrorBookingsRange(dateStr, dateStr)
    const activeEvents = bookings
      .filter((b) => isAttendedStatus(b.status))
      .map((b) => ({
        id: b.documentId,
        customer_name: b.client?.name || b.clientNameRaw || '',
        customer: b.client ? clientKey(b.client) : '',
        status: b.status,
        starts_at: b.startsAt,
        ends_at: b.endsAt,
        event_types: (b.services || []).map((s) => ({
          title: s.title || '',
          price: { amount: s.price ?? null },
        })),
        employee: { name: b.employeeNameRaw || '' },
      }))
    return { found: activeEvents.length > 0, count: activeEvents.length, events: activeEvents }
  } catch (e) {
    console.error('fetchCalendarBookings error:', e)
    return { found: false, count: 0, events: [], error: `rezervace z kalendáře: ${errText(e)}` }
  }
}

// Карта id клиента → текущее имя (из НАШЕЙ коллекции client). Ленивый фолбэк
// пере-матча имён (s97) — с текущими именами из relation почти не срабатывает,
// но остаётся страховкой при опечатках в clientName записей Strapi.
export const fetchCurrentClientNames = async (): Promise<Map<string, string>> => {
  try {
    // только «ключ → имя»: телефоны и адреса всех клиентов салона этой странице не нужны
    return await fetchMirrorClientNames()
  } catch (e) {
    console.error('fetchCurrentClientNames error:', e)
    return new Map()
  }
}

// Find card-profit record for the month of the given date (one record per month)
export const findMonthlyCardProfit = async (dateStr: string) => {
  const [year, month] = dateStr.split('-')
  const monthStart = `${year}-${month}-01`
  const monthEnd = monthEndYmd(Number(year), Number(month) - 1)

  // Search both published and draft
  const [published, drafts] = await Promise.all([
    Axios.get(`/api/card-profits?filters[date][$gte]=${monthStart}&filters[date][$lte]=${monthEnd}&pagination[pageSize]=1`),
    Axios.get(`/api/card-profits?filters[date][$gte]=${monthStart}&filters[date][$lte]=${monthEnd}&pagination[pageSize]=1&status=draft`),
  ])
  const pubItems = Array.isArray(published) ? published : []
  const draftItems = Array.isArray(drafts) ? drafts : []
  return draftItems[0] || pubItems[0] || null
}

// Read the current published monthly card-profit (sum + extraIncome) for pre-filling
// the close form. Returns null if no card-profit exists yet for that month.
