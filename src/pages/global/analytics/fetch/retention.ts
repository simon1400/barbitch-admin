import { getEventsHistory, fetchEmployeeNames, isAttended, todayStr } from './eventsHistory'
import { fetchMirrorEmployees } from '../../../../lib/mirror'

// Возвращаемость по мастерам: какой % НОВЫХ клиентов мастера вернулся в салон
// в течение 30/60/90 дней после ПЕРВОГО визита. Новый клиент атрибутируется
// мастеру его первого визита. «Вернулся» = любой следующий состоявшийся визит
// (к любому мастеру); отдельно — возврат к тому же мастеру (≤90 дней).
// Для каждого окна W учитываются только клиенты, чей первый визит был
// не позже чем W дней назад (иначе окно ещё не закрыто и % занижался бы).

export interface RetentionRow {
  employeeId: string
  name: string
  newClients: number // первый визит ≥90 дней назад (база для 90д-колонки)
  r30: { eligible: number; returned: number; pct: number | null }
  r60: { eligible: number; returned: number; pct: number | null }
  r90: { eligible: number; returned: number; pct: number | null }
  same90: { eligible: number; returned: number; pct: number | null }
}

export interface RetentionResult {
  rows: RetentionRow[]
  total: RetentionRow
}

const addDaysStr = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number)
  const res = new Date(y, m - 1, d + days)
  return `${res.getFullYear()}-${String(res.getMonth() + 1).padStart(2, '0')}-${String(
    res.getDate(),
  ).padStart(2, '0')}`
}

const pctOf = (returned: number, eligible: number): number | null =>
  eligible > 0 ? Math.round((returned / eligible) * 100) : null

const emptyWindow = () => ({ eligible: 0, returned: 0, pct: null as number | null })

export const getRetention = async (force = false): Promise<RetentionResult> => {
  const [events, empNames, activeEmployees] = await Promise.all([
    getEventsHistory(force),
    fetchEmployeeNames(),
    fetchMirrorEmployees(), // только активные (personal isActive) — их и показываем
  ])
  const activeIds = new Set(activeEmployees.map((e) => e.id))
  const today = todayStr()

  // Состоявшиеся визиты по клиентам, отсортированные по дате
  const visits = new Map<string, Array<{ date: string; employee: string }>>()
  for (const e of events) {
    if (!e.customer || e.date > today || !isAttended(e)) continue
    if (!visits.has(e.customer)) visits.set(e.customer, [])
    visits.get(e.customer)!.push({ date: e.date, employee: e.employee })
  }

  interface Acc {
    newClients: number
    w: Record<30 | 60 | 90, { eligible: number; returned: number }>
    same: { eligible: number; returned: number }
  }
  const byMaster = new Map<string, Acc>()
  const totalAcc: Acc = {
    newClients: 0,
    w: { 30: { eligible: 0, returned: 0 }, 60: { eligible: 0, returned: 0 }, 90: { eligible: 0, returned: 0 } },
    same: { eligible: 0, returned: 0 },
  }

  const cutoff = (days: number) => addDaysStr(today, -days)

  for (const list of visits.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1))
    const first = list[0]
    if (!first.employee) continue

    let acc = byMaster.get(first.employee)
    if (!acc) {
      acc = {
        newClients: 0,
        w: { 30: { eligible: 0, returned: 0 }, 60: { eligible: 0, returned: 0 }, 90: { eligible: 0, returned: 0 } },
        same: { eligible: 0, returned: 0 },
      }
      byMaster.set(first.employee, acc)
    }

    const rest = list.slice(1)
    for (const days of [30, 60, 90] as const) {
      if (first.date > cutoff(days)) continue // окно ещё не закрыто
      const limit = addDaysStr(first.date, days)
      const returned = rest.some((v) => v.date <= limit)
      acc.w[days].eligible++
      totalAcc.w[days].eligible++
      if (returned) {
        acc.w[days].returned++
        totalAcc.w[days].returned++
      }
      if (days === 90) {
        acc.newClients++
        totalAcc.newClients++
        acc.same.eligible++
        totalAcc.same.eligible++
        const returnedSame = rest.some((v) => v.date <= limit && v.employee === first.employee)
        if (returnedSame) {
          acc.same.returned++
          totalAcc.same.returned++
        }
      }
    }
  }

  const toRow = (employeeId: string, name: string, acc: Acc): RetentionRow => ({
    employeeId,
    name,
    newClients: acc.newClients,
    r30: { ...acc.w[30], pct: pctOf(acc.w[30].returned, acc.w[30].eligible) },
    r60: { ...acc.w[60], pct: pctOf(acc.w[60].returned, acc.w[60].eligible) },
    r90: { ...acc.w[90], pct: pctOf(acc.w[90].returned, acc.w[90].eligible) },
    same90: { ...acc.same, pct: pctOf(acc.same.returned, acc.same.eligible) },
  })

  // Показываем только АКТИВНЫХ мастеров (уволенные/удалённые — нет смысла оценивать),
  // но строка «Весь салон» считается по всей истории, включая бывших.
  const rows = [...byMaster.entries()]
    .filter(([id]) => activeIds.has(id))
    .map(([id, acc]) => toRow(id, empNames.get(id) ?? id, acc))
    .filter((r) => r.newClients >= 3) // меньше — статистически шум
    .sort((a, b) => b.newClients - a.newClients)

  const total = toRow('total', 'Весь салон', totalAcc)
  // у total окна могут быть пустыми, защитимся
  if (!rows.length) {
    return { rows: [], total: { ...total, r30: emptyWindow(), r60: emptyWindow(), r90: emptyWindow(), same90: emptyWindow(), newClients: 0 } }
  }
  return { rows, total }
}
