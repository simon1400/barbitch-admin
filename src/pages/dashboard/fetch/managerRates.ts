import { Axios } from '../../../lib/api'
import { strapiQuery } from '../../../lib/strapiQuery'
import { daysInMonth } from '../../../utils/date'

import { managerMonthlyFixed, managersFor, type ManagerRateItem } from './teamSplit'

// Ставки управляющих (s213) — один запрос на период, только когда роль в периоде есть
// (до `since` запроса нет вовсе, и прошлые месяцы считаются ровно как раньше).
const fetchManagerRates = async (names: string[]): Promise<Map<string, ManagerRateItem[]>> => {
  const query = strapiQuery({
    filters: { name: { $in: names } },
    fields: ['name'],
    populate: { rates: { fields: ['rate', 'from', 'to', 'typeWork'] } },
    pagination: { page: 1, pageSize: 50 },
    status: 'published',
  })
  const rows = (await Axios.get(`/api/personals?${query}`)) as { name: string; rates?: ManagerRateItem[] }[]
  return new Map((rows || []).map((r) => [r.name, r.rates || []]))
}

/**
 * Оклад каждой управляющей за ЦЕЛЫЙ месяц: по записи, действующей в последний день
 * месяца. Отсутствия оклад не уменьшают (решение владельца), поэтому оклад целиком
 * входит в месяц с первого числа — закрытие смены его «до» и «после» видит одинаково.
 */
export const fetchManagerMonthFixed = async (
  periodStart: string,
  monthEndStr: string,
): Promise<Map<string, number | null>> => {
  const list = managersFor(periodStart)
  if (!list.length) return new Map()
  const rates = await fetchManagerRates(list.map((m) => m.name))
  return new Map(list.map((m) => [m.name, managerMonthlyFixed(rates.get(m.name), m.since, monthEndStr)]))
}

/**
 * Доля оклада за произвольный диапазон дней (обзор недели): каждый день — оклад
 * своего месяца / число дней в этом месяце. Сумма = 0, пока оклад не задан.
 */
export const fetchManagersFixedForRange = async (firstDay: Date, lastDay: Date): Promise<number> => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const days: Date[] = []
  const cur = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate())
  const end = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate())
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  const lastYm = `${end.getFullYear()}-${pad(end.getMonth() + 1)}`
  const list = managersFor(lastYm)
  if (!list.length || !days.length) return 0
  const rates = await fetchManagerRates(list.map((m) => m.name))
  let total = 0
  for (const d of days) {
    const ymStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const dayStr = `${ymStr}-${pad(d.getDate())}`
    const inMonth = daysInMonth(d.getFullYear(), d.getMonth())
    for (const m of list) {
      if (m.since > ymStr) continue
      const fixed = managerMonthlyFixed(rates.get(m.name), m.since, dayStr)
      if (fixed) total += fixed / inMonth
    }
  }
  return total
}
