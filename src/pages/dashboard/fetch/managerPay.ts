import { isCzechWorkingDay, workingDaysInMonth } from '../../global/team/fetch/czechTax'
import { addDaysYmd, daysInMonth } from '../../../utils/date'

import { managerMonthlyFixed, type ManagerRateItem } from './teamSplit'

// Зарплата управляющей по часам (s294, решение владельца 17.11.2026).
//
// Раньше оклад входил в месяц ЦЕЛИКОМ с 1-го числа: в начале месяца «Результат» сразу
// показывал −19 011, хотя управляющая получает только за отработанное.
//
// Теперь, с месяца MANAGER_HOURLY_SINCE:
//   ставка в час = оклад месяца / (рабочие дни месяца × 8 ч)
//     рабочие дни — Пн–Пт без чешских госпраздников (тот же фонд, что в калькуляторе налогов);
//   часы дня = часы из ПОДАННОГО výkazu (сколько написала — столько и оплачивается),
//     нет výkazu за день — 0 (не закрыла смену — не получает);
//   отпуск / больничный из «Больничные / отпуска» с галочкой «оплачивается» — 8 ч за каждый
//     рабочий день (без галочки — 0), только по сегодняшний день включительно, чтобы
//     будущий отпуск не входил в месяц заранее. Если в такой день есть и výkaz — берётся
//     большее из двух.
// Месяцы до MANAGER_HOURLY_SINCE не меняются: полный оклад, как считалось (октябрь 2026
// уже выплачен — решение владельца).

/** Первый месяц расчёта по часам ('YYYY-MM'). Раньше — полный оклад. */
export const MANAGER_HOURLY_SINCE = '2026-11'
/** Часов в рабочем дне — для ставки и для оплачиваемого отпуска/больничного. */
export const HOURS_PER_DAY = 8

export interface ManagerTimeOff {
  type: string
  startDate: string
  endDate: string
  paid: boolean
}

/** Факты одной управляющей из `/engine/admin/work-reports/hours`. */
export interface ManagerHoursFacts {
  days: { date: string; hours: number }[]
  timeOffs: ManagerTimeOff[]
}

/** Сколько начислено управляющей за период и из чего. */
export interface ManagerPay {
  /** деньги за период; null — оклад не задан (нет записи HPP с from ≥ since) */
  amount: number | null
  /** 'fixed' — старый расчёт (полный оклад); 'hourly' — по часам */
  mode: 'fixed' | 'hourly'
  /** часы из поданных výkazů */
  workedHours: number
  /** оплачиваемые часы отпуска / больничного */
  leaveHours: number
  /** ставка в час (последнего месяца периода с ставкой); 0 — нет */
  hourRate: number
  /** оклад месяца (справочно, для подписи); 0 — не задан */
  monthFixed: number
  /** рабочих дней в месяце (справочно) */
  workDays: number
}

const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = []
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) out.push(d)
  return out
}

const ymParts = (ymStr: string): [number, number] => {
  const [y, m] = ymStr.split('-').map(Number)
  return [y, m - 1]
}

/** Ставка в час на дату: оклад, действующий в этот день / (рабочие дни месяца × 8). */
export const managerHourRate = (
  rates: ManagerRateItem[] | null | undefined,
  since: string,
  dateStr: string,
): { rate: number; fixed: number; workDays: number } | null => {
  const fixed = managerMonthlyFixed(rates, since, dateStr)
  if (fixed == null) return null
  const [y, m] = ymParts(dateStr.slice(0, 7))
  const workDays = workingDaysInMonth(m, y)
  if (!workDays) return null
  return { rate: fixed / (workDays * HOURS_PER_DAY), fixed, workDays }
}

/** Оплачиваемый отпуск/больничный на день: рабочий день, запись с «оплачивается». */
const paidLeaveOn = (timeOffs: ManagerTimeOff[], day: string): boolean =>
  isCzechWorkingDay(day) && timeOffs.some((t) => t.paid && t.startDate <= day && day <= t.endDate)

/**
 * Начисление за диапазон дней [from, to] (YYYY-MM-DD, включительно).
 * Дни до `since` (до роли) не считаются. Дни месяцев до MANAGER_HOURLY_SINCE — доля
 * полного оклада (оклад / дней в месяце), как прежний обзор недели.
 * today — сегодня по Праге: отпуск позже него не начисляется.
 */
export const managerPayForRange = (args: {
  rates: ManagerRateItem[] | null | undefined
  since: string
  facts: ManagerHoursFacts | null | undefined
  from: string
  to: string
  today: string
}): ManagerPay => {
  const { rates, since, from, to, today } = args
  const reportHours = new Map((args.facts?.days || []).map((d) => [d.date, Number(d.hours) || 0]))
  const timeOffs = args.facts?.timeOffs || []
  const res: ManagerPay = {
    amount: 0,
    mode: 'fixed',
    workedHours: 0,
    leaveHours: 0,
    hourRate: 0,
    monthFixed: 0,
    workDays: 0,
  }
  let missing = false
  let anyRate = false
  for (const day of datesBetween(from, to)) {
    const ymStr = day.slice(0, 7)
    if (ymStr < since) continue
    if (ymStr < MANAGER_HOURLY_SINCE) {
      const fixed = managerMonthlyFixed(rates, since, day)
      if (fixed == null) {
        missing = true
        continue
      }
      anyRate = true
      const [y, m] = ymParts(ymStr)
      res.amount = (res.amount ?? 0) + fixed / daysInMonth(y, m)
      res.monthFixed = fixed
      continue
    }
    res.mode = 'hourly'
    const r = managerHourRate(rates, since, day)
    if (!r) {
      missing = true
      continue
    }
    anyRate = true
    res.hourRate = r.rate
    res.monthFixed = r.fixed
    res.workDays = r.workDays
    const worked = reportHours.get(day) ?? 0
    const leave = day <= today && paidLeaveOn(timeOffs, day) ? HOURS_PER_DAY : 0
    if (leave > worked) res.leaveHours += leave
    else res.workedHours += worked
    res.amount = (res.amount ?? 0) + Math.max(worked, leave) * r.rate
  }
  // Оклад не задан ни на один день — «не задан» (как прежде), а не «0 Kč заработано».
  if (missing && !anyRate) res.amount = null
  return res
}

/**
 * Начисление за целый месяц (YYYY-MM). До MANAGER_HOURLY_SINCE — прежнее правило:
 * полный оклад по записи на последний день месяца, ровно как считалось раньше.
 */
export const managerPayForMonth = (args: {
  rates: ManagerRateItem[] | null | undefined
  since: string
  facts: ManagerHoursFacts | null | undefined
  periodStart: string
  monthEnd: string
  today: string
}): ManagerPay => {
  const { rates, since, periodStart, monthEnd } = args
  if (periodStart < MANAGER_HOURLY_SINCE) {
    const fixed = managerMonthlyFixed(rates, since, monthEnd)
    return {
      amount: fixed,
      mode: 'fixed',
      workedHours: 0,
      leaveHours: 0,
      hourRate: 0,
      monthFixed: fixed ?? 0,
      workDays: 0,
    }
  }
  return managerPayForRange({ ...args, from: `${periodStart}-01`, to: monthEnd })
}
