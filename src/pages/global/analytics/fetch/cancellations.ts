import { getEventsHistory, fetchEmployeeNames, todayStr } from './eventsHistory'

// Аналитика отмен и no-show за выбранный месяц (из истории броней).
// «Потеряно» = длительность слота и цена брони. Для отмен это верхняя оценка
// (слот могли перебронировать), для no-show — фактическая потеря.

export interface CancelStats {
  count: number
  lostMin: number
  lostMoney: number
}

export interface MasterCancelRow {
  name: string
  noshow: CancelStats
  cancelled: CancelStats
}

export interface ClientCancelRow {
  customerId: string
  name: string
  noshowCount: number
  cancelledCount: number
  lostMoney: number
  lastDate: string
}

export interface WeekdayCancelRow {
  label: string
  noshow: number
  cancelled: number
}

export interface CancellationsData {
  noshow: CancelStats
  cancelled: CancelStats
  totalVisits: number // состоявшиеся за месяц — для контекста (% отмен)
  byMaster: MasterCancelRow[]
  topClients: ClientCancelRow[]
  byWeekday: WeekdayCancelRow[]
}

const DOW_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

const emptyStats = (): CancelStats => ({ count: 0, lostMin: 0, lostMoney: 0 })

const add = (s: CancelStats, durMin: number, price: number) => {
  s.count++
  s.lostMin += durMin
  s.lostMoney += price
}

// month — 0-based
export const getCancellations = async (
  month: number,
  year: number,
  force = false,
): Promise<CancellationsData> => {
  const [events, empNames] = await Promise.all([getEventsHistory(force), fetchEmployeeNames()])
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const today = todayStr()

  const noshow = emptyStats()
  const cancelled = emptyStats()
  let totalVisits = 0
  const byMaster = new Map<string, MasterCancelRow>()
  const byClient = new Map<string, ClientCancelRow>()
  const dowNoshow = new Map<number, number>()
  const dowCancelled = new Map<number, number>()

  for (const e of events) {
    if (!e.date.startsWith(prefix)) continue
    const isNoshow = e.status === 'noshow'
    const isCancelled = e.status === 'cancelled'
    if (!isNoshow && !isCancelled) {
      if (e.date <= today) totalVisits++
      continue
    }

    add(isNoshow ? noshow : cancelled, e.durationMin, e.price)

    const mName = empNames.get(e.employee) ?? '—'
    let m = byMaster.get(mName)
    if (!m) {
      m = { name: mName, noshow: emptyStats(), cancelled: emptyStats() }
      byMaster.set(mName, m)
    }
    add(isNoshow ? m.noshow : m.cancelled, e.durationMin, e.price)

    if (e.customer) {
      let c = byClient.get(e.customer)
      if (!c) {
        c = {
          customerId: e.customer,
          name: e.customerName || '—',
          noshowCount: 0,
          cancelledCount: 0,
          lostMoney: 0,
          lastDate: '',
        }
        byClient.set(e.customer, c)
      }
      if (isNoshow) c.noshowCount++
      else c.cancelledCount++
      c.lostMoney += e.price
      if (e.date > c.lastDate) c.lastDate = e.date
      if (e.customerName) c.name = e.customerName
    }

    const [y, mm, dd] = e.date.split('-').map(Number)
    const dow = new Date(y, mm - 1, dd).getDay()
    if (isNoshow) dowNoshow.set(dow, (dowNoshow.get(dow) || 0) + 1)
    else dowCancelled.set(dow, (dowCancelled.get(dow) || 0) + 1)
  }

  const order = [1, 2, 3, 4, 5, 6, 0]
  const byWeekday: WeekdayCancelRow[] = order.map((d) => ({
    label: DOW_RU[d],
    noshow: dowNoshow.get(d) || 0,
    cancelled: dowCancelled.get(d) || 0,
  }))

  return {
    noshow,
    cancelled,
    totalVisits,
    byMaster: [...byMaster.values()].sort(
      (a, b) => b.noshow.count + b.cancelled.count - (a.noshow.count + a.cancelled.count),
    ),
    topClients: [...byClient.values()]
      .sort((a, b) => b.noshowCount + b.cancelledCount - (a.noshowCount + a.cancelledCount))
      .slice(0, 15),
    byWeekday,
  }
}
