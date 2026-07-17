import { getEventsHistory, isAttended, isActive, todayStr } from './eventsHistory'
import { getExpenses } from '../../fetch/expenses'

// Прогноз текущего месяца по броням календаря.
// ⚠️ «Выручка» здесь = сумма ЦЕН броней (event_types price), а не фактическая касса —
// скидки/допродажи/ваучеры не учитываются. Это оценка темпа, точные деньги — в GlobalPage.

export interface MonthRevenueRow {
  month: string // 'YYYY-MM'
  label: string
  revenue: number
  visits: number
}

export interface ForecastData {
  monthLabel: string
  daysPassed: number
  daysTotal: number
  actualToDate: number // состоявшиеся визиты с 1-го по сегодня
  visitsToDate: number
  futureBooked: number // активные брони с завтра до конца месяца
  futureVisits: number
  forecastBooked: number // факт + будущие брони (консервативный)
  forecastRunRate: number // факт / прошло дней × всего дней
  prevMonthTotal: number
  prevMonthToSameDay: number // прошлый месяц на ту же дату — честное сравнение темпа
  expensesMonth: number // затраты (costs) текущего месяца
  history: MonthRevenueRow[] // последние 6 полных месяцев
}

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const ym = (d: string) => d.slice(0, 7)
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `${MONTHS_RU[Number(mm) - 1]} ${y}`
}

export const getForecast = async (force = false): Promise<ForecastData> => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = todayStr()
  const daysTotal = new Date(year, month + 1, 0).getDate()
  const daysPassed = now.getDate()

  const curMonth = ym(today)
  const prev = new Date(year, month - 1, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  const prevSameDay = `${prevMonth}-${String(Math.min(daysPassed, new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate())).padStart(2, '0')}`

  const [events, expenses] = await Promise.all([getEventsHistory(force), getExpenses(month, year)])

  let actualToDate = 0
  let visitsToDate = 0
  let futureBooked = 0
  let futureVisits = 0
  let prevMonthTotal = 0
  let prevMonthToSameDay = 0
  const histRevenue = new Map<string, { revenue: number; visits: number }>()

  for (const e of events) {
    const m = ym(e.date)
    if (m === curMonth) {
      if (e.date <= today) {
        if (isAttended(e)) {
          actualToDate += e.price
          visitsToDate++
        }
      } else if (isActive(e)) {
        futureBooked += e.price
        futureVisits++
      }
      continue
    }
    if (e.date > today || !isAttended(e)) continue
    if (m === prevMonth) {
      prevMonthTotal += e.price
      if (e.date <= prevSameDay) prevMonthToSameDay += e.price
    }
    const h = histRevenue.get(m) || { revenue: 0, visits: 0 }
    h.revenue += e.price
    h.visits++
    histRevenue.set(m, h)
  }

  const history: MonthRevenueRow[] = []
  for (let i = 6; i >= 1; i--) {
    const d = new Date(year, month - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const h = histRevenue.get(m) || { revenue: 0, visits: 0 }
    history.push({ month: m, label: monthLabel(m), revenue: Math.round(h.revenue), visits: h.visits })
  }

  const expensesMonth = expenses.reduce((a, x) => a + (x.sum || 0), 0)

  return {
    monthLabel: monthLabel(curMonth),
    daysPassed,
    daysTotal,
    actualToDate: Math.round(actualToDate),
    visitsToDate,
    futureBooked: Math.round(futureBooked),
    futureVisits,
    forecastBooked: Math.round(actualToDate + futureBooked),
    forecastRunRate: Math.round((actualToDate / Math.max(1, daysPassed)) * daysTotal),
    prevMonthTotal: Math.round(prevMonthTotal),
    prevMonthToSameDay: Math.round(prevMonthToSameDay),
    expensesMonth: Math.round(expensesMonth),
    history,
  }
}
