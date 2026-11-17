import { Axios } from '../../../lib/api'
import { makeApiFetch } from '../../../lib/apiFetch'
import { strapiQuery } from '../../../lib/strapiQuery'
import { todayYmd, ymd as ymdOf } from '../../../utils/date'

import { MANAGER_HOURLY_SINCE, managerPayForMonth, managerPayForRange, type ManagerHoursFacts, type ManagerPay } from './managerPay'
import { fetchPayrollGroups } from './payrollGroups'
import { managersFor, type ManagerRateItem } from './teamSplit'

// Ставки управляющих (s213) — один запрос на период, только когда роль в периоде есть
// (до `since` запроса нет вовсе, и прошлые месяцы считаются ровно как раньше).
// s229: карточка — по documentId из группы (раньше по имени); ключ ответа — docId.
const fetchManagerRates = async (docIds: string[]): Promise<Map<string, ManagerRateItem[]>> => {
  const query = strapiQuery({
    filters: { documentId: { $in: docIds } },
    fields: ['name'],
    populate: { rates: { fields: ['rate', 'from', 'to', 'typeWork'] } },
    pagination: { page: 1, pageSize: 50 },
    status: 'published',
  })
  const rows = (await Axios.get(`/api/personals?${query}`)) as { documentId: string; rates?: ManagerRateItem[] }[]
  return new Map((rows || []).map((r) => [r.documentId, r.rates || []]))
}

const engineFetch = makeApiFetch('/api/engine/admin', {}, (s) => `Ошибка ${s}`)

// s294: часы поданных výkazů и отпуска/больничные управляющих (по documentId карточки).
// 🟥 Ошибка НЕ глотается: месяц, посчитанный «без часов», лёг бы в вечный кэш прошлых
// месяцев с нулевой зарплатой управляющей.
const fetchManagerHours = async (from: string, to: string): Promise<Map<string, ManagerHoursFacts>> => {
  const res = await engineFetch<{ people?: ({ documentId: string } & ManagerHoursFacts)[] }>(
    'GET',
    `/work-reports/hours?from=${from}&to=${to}`,
  )
  return new Map((res?.people || []).map((p) => [p.documentId, { days: p.days || [], timeOffs: p.timeOffs || [] }]))
}

/**
 * Начисление каждой управляющей за ЦЕЛЫЙ месяц (имя → ManagerPay).
 * До MANAGER_HOURLY_SINCE — полный оклад по записи на последний день месяца (как раньше);
 * с него — ставка в час × часы закрытых výkazů + оплачиваемые отпуска (managerPay.ts).
 * Закрытие смены не меняет часы управляющей, поэтому «до» и «после» смены начисление одно.
 */
export const fetchManagerMonthFixed = async (
  periodStart: string,
  monthEndStr: string,
): Promise<Map<string, ManagerPay>> => {
  const list = managersFor(await fetchPayrollGroups(), periodStart)
  if (!list.length) return new Map()
  const hourly = periodStart >= MANAGER_HOURLY_SINCE
  const [rates, hours] = await Promise.all([
    fetchManagerRates(list.map((m) => m.docId)),
    hourly ? fetchManagerHours(`${periodStart}-01`, monthEndStr) : Promise.resolve(new Map<string, ManagerHoursFacts>()),
  ])
  const today = todayYmd()
  return new Map(
    list.map((m) => [
      m.name,
      managerPayForMonth({
        rates: rates.get(m.docId),
        since: m.since,
        facts: hours.get(m.docId),
        periodStart,
        monthEnd: monthEndStr,
        today,
      }),
    ]),
  )
}

/**
 * Начисление управляющим за произвольный диапазон дней (обзор недели): дни до
 * MANAGER_HOURLY_SINCE — доля оклада (оклад / дней в месяце), с него — по часам.
 */
export const fetchManagersFixedForRange = async (firstDay: Date, lastDay: Date): Promise<number> => {
  const from = ymdOf(firstDay)
  const to = ymdOf(lastDay)
  if (from > to) return 0
  const list = managersFor(await fetchPayrollGroups(), to.slice(0, 7))
  if (!list.length) return 0
  const hourly = to.slice(0, 7) >= MANAGER_HOURLY_SINCE
  const [rates, hours] = await Promise.all([
    fetchManagerRates(list.map((m) => m.docId)),
    hourly ? fetchManagerHours(from, to) : Promise.resolve(new Map<string, ManagerHoursFacts>()),
  ])
  const today = todayYmd()
  let total = 0
  for (const m of list) {
    const pay = managerPayForRange({ rates: rates.get(m.docId), since: m.since, facts: hours.get(m.docId), from, to, today })
    total += pay.amount ?? 0
  }
  return total
}
