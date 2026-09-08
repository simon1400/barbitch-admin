import { daysInMonth, monthLabelRu, ym as ymOfDate } from '../../../../utils/date'
import { getEventsHistory, isAttended, isActive, todayStr } from './eventsHistory'
import { getExpenses } from '../../fetch/expenses'

// Прогноз текущего месяца по броням календаря.
// ⚠️ «Выручка» здесь = сумма ЦЕН броней (event_types price), а не фактическая касса —
// скидки/допродажи/ваучеры не учитываются. Это оценка темпа, точные деньги — в GlobalPage.

interface MonthRevenueRow {
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
  history: MonthRevenueRow[] // ВСЕ полные месяцы с данными (по возрастанию), период выбирается в UI
}

const ym = (d: string) => d.slice(0, 7)

export const getForecast = async (force = false): Promise<ForecastData> => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = todayStr()
  const daysTotal = daysInMonth(year, month)
  const daysPassed = now.getDate()

  const curMonth = ym(today)
  const prev = new Date(year, month - 1, 1)
  const prevMonth = ymOfDate(prev)
  const prevSameDay = `${prevMonth}-${String(Math.min(daysPassed, daysInMonth(prev.getFullYear(), prev.getMonth()))).padStart(2, '0')}`

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

  // История = все полные месяцы: от первого месяца с данными до прошлого месяца включительно.
  // Пустые месяцы в середине заполняются нулями (непрерывная шкала для графика/приростов).
  let firstMonth = prevMonth
  for (const m of histRevenue.keys()) if (m < firstMonth) firstMonth = m
  const [fy, fm] = firstMonth.split('-').map(Number)
  const history: MonthRevenueRow[] = []
  const cursor = new Date(fy, fm - 1, 1)
  const historyEnd = new Date(year, month - 1, 1) // прошлый месяц — последний полный
  while (cursor <= historyEnd) {
    const m = ymOfDate(cursor)
    const h = histRevenue.get(m) || { revenue: 0, visits: 0 }
    history.push({ month: m, label: monthLabelRu(m), revenue: Math.round(h.revenue), visits: h.visits })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const expensesMonth = expenses.reduce((a, x) => a + (x.sum || 0), 0)

  return {
    monthLabel: monthLabelRu(curMonth),
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
