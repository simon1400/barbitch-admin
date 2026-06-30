import type { IFilteredAdminsData } from './allAdminsHours'
import type { IFilteredData } from './allWorks'
import type { GroupedSum, OutputMetrictsItem } from './fetchHelpers'
import type { CombinedResult } from './teamSplit'

import { getAdminsHours } from './allAdminsHours'
import { getAllWorks } from './allWorks'
import { getMoney } from './costs'
import { getEvents } from './getEvents'
import { splitTeam } from './teamSplit'

// Кэш агрегированных месячных данных «Финансового обзора» / зарплат / графиков.
// Считается ОДИН раз на (месяц, год) и переиспользуется всеми модулями
// (GlobalPage, SalariesTab, ChartsTab, AdministratorCabinetPage) — они зовут
// useGlobalMonthData, который тянет отсюда. Хранится в localStorage (переживает
// F5) + зеркало в памяти. Сбрасывается по TTL и принудительно при закрытии/
// реверте смены (invalidateGlobalMonthData в publishShift/revertShift).

export interface GlobalMonthData {
  works: IFilteredData['summary']
  admins: IFilteredAdminsData['summary']
  combined: CombinedResult[]
  sumClientsDone: number
  globalFlow: number
  sumMasters: number
  sumAdmins: number
  sumCombined: number
  combinedAdminEarnings: number
  daysResult: GroupedSum[]
  costs: number
  noDphCosts: number
  cardMoney: number
  cardExtraIncome: number
  cashMoney: number
  payrollSum: number
  voucherRealized: number
  voucherPayed: number
  extraMoney: number
  qrMoney: number
  salonSalariesCash: number
  salonSalariesCard: number
  taxesSum: number
  clients: {
    all: number
    canceled: number
    noshow: number
    payed: number
    pastPayed: number
    fixed: number
    countCreatedMonthReservation: number
    countCreatedTodayReservation: number
    monthReservationIndex: number
  }
  dataMetrics: OutputMetrictsItem[]
}

export const EMPTY_GLOBAL_MONTH_DATA: GlobalMonthData = {
  works: [],
  admins: [],
  combined: [],
  sumClientsDone: 0,
  globalFlow: 0,
  sumMasters: 0,
  sumAdmins: 0,
  sumCombined: 0,
  combinedAdminEarnings: 0,
  daysResult: [],
  costs: 0,
  noDphCosts: 0,
  cardMoney: 0,
  cardExtraIncome: 0,
  cashMoney: 0,
  payrollSum: 0,
  voucherRealized: 0,
  voucherPayed: 0,
  extraMoney: 0,
  qrMoney: 0,
  salonSalariesCash: 0,
  salonSalariesCard: 0,
  taxesSum: 0,
  clients: {
    all: 0,
    canceled: 0,
    noshow: 0,
    payed: 0,
    pastPayed: 0,
    fixed: 0,
    countCreatedMonthReservation: 0,
    countCreatedTodayReservation: 0,
    monthReservationIndex: 0,
  },
  dataMetrics: [],
}

const PREFIX = 'bb_global_month_'
const TTL_CURRENT = 10 * 60 * 1000 // текущий месяц волатилен → 10 минут

interface CacheEntry {
  ts: number
  data: GlobalMonthData
}

const memCache = new Map<string, CacheEntry>()

const keyOf = (month: number, year: number) => `${PREFIX}${year}_${month}`

// Момент окончания месяца (= начало следующего) в локальном времени.
const endOfMonthTs = (month: number, year: number) => new Date(year, month + 1, 1).getTime()

const isCurrentMonth = (month: number, year: number) => {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() === month
}

const isFutureMonth = (month: number, year: number) => {
  const now = new Date()
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())
}

// Годен ли кэш записи без принудительного пересчёта.
// • текущий месяц — волатилен → только в пределах TTL;
// • прошлый месяц — НЕИЗМЕНЕН после закрытия → годен ВЕЧНО, но лишь если запись
//   была посчитана ПОСЛЕ конца месяца (иначе это устаревший снимок середины месяца);
// • будущий месяц — всегда пересчитываем.
const isEntryFresh = (entry: CacheEntry, month: number, year: number): boolean => {
  if (isFutureMonth(month, year)) return false
  if (isCurrentMonth(month, year)) return Date.now() - entry.ts < TTL_CURRENT
  // прошлый месяц: доверяем, только если посчитан после его окончания
  return entry.ts >= endOfMonthTs(month, year)
}

const readLs = (key: string): CacheEntry | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (typeof parsed?.ts !== 'number' || !parsed.data) return null
    return parsed
  } catch {
    return null
  }
}

const writeLs = (key: string, entry: CacheEntry) => {
  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // localStorage недоступен / переполнен — кэш просто остаётся в памяти
  }
}

const removeLs = (key: string) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const computeGlobalMonthData = async (
  month: number,
  year: number,
): Promise<GlobalMonthData> => {
  const [worksRes, adminsRes, moneyRes, eventsRes] = await Promise.all([
    getAllWorks(month, year),
    getAdminsHours(month, year),
    getMoney(month, year),
    getEvents(month, year),
  ])

  // Совместители (мастер+администратор) выносятся в отдельную группу. Инвариант
  // splitTeam: sumMasters + sumAdmins + sumCombined === старый (sumMasters + sumAdmins),
  // поэтому «Результат за месяц» не меняется численно.
  const team = splitTeam(worksRes.summary, adminsRes.summary)

  return {
    works: team.masters,
    sumClientsDone: worksRes.sumClientsDone,
    globalFlow: worksRes.globalFlow,
    sumMasters: team.sumMasters,
    daysResult: worksRes.daysResult,
    admins: team.admins,
    sumAdmins: team.sumAdmins,
    combined: team.combined,
    sumCombined: team.sumCombined,
    combinedAdminEarnings: team.combinedAdminEarnings,
    costs: moneyRes.sumCosts,
    noDphCosts: moneyRes.sumNoDphCosts,
    cardMoney: moneyRes.cardMoney,
    cardExtraIncome: moneyRes.cardExtraIncome,
    cashMoney: moneyRes.cashMoney,
    payrollSum: moneyRes.payrollSum,
    voucherRealized: moneyRes.voucherRealizedSum,
    voucherPayed: moneyRes.voucherPayedSum,
    extraMoney: moneyRes.extraMoneySum,
    qrMoney: moneyRes.qrMoney,
    salonSalariesCash: worksRes.salonSalariesCash,
    salonSalariesCard: worksRes.salonSalariesCard,
    taxesSum: moneyRes.taxesSum,
    clients: {
      all: eventsRes.all,
      canceled: eventsRes.cancelled,
      noshow: eventsRes.noshow,
      payed: eventsRes.payed,
      pastPayed: eventsRes.pastPayed,
      fixed: eventsRes.fixed,
      // x-total-count приходит строкой — приводим к числу, иначе суммирование за
      // период склеивает строки ("0"+"248"+… вместо сложения).
      countCreatedMonthReservation: Number(eventsRes.countCreatedMonthReservation) || 0,
      countCreatedTodayReservation: Number(eventsRes.countCreatedTodayReservation) || 0,
      monthReservationIndex: eventsRes.monthReservationIndex as number,
    },
    dataMetrics: eventsRes.dataMetrics,
  }
}

export interface GlobalMonthDataResult {
  data: GlobalMonthData
  cachedAt: number
  fromCache: boolean
}

export const getGlobalMonthData = async (
  month: number,
  year: number,
  force = false,
): Promise<GlobalMonthDataResult> => {
  const key = keyOf(month, year)

  if (!force) {
    const mem = memCache.get(key)
    if (mem && isEntryFresh(mem, month, year)) {
      return { data: mem.data, cachedAt: mem.ts, fromCache: true }
    }
    const ls = readLs(key)
    if (ls && isEntryFresh(ls, month, year)) {
      memCache.set(key, ls)
      return { data: ls.data, cachedAt: ls.ts, fromCache: true }
    }
  }

  const data = await computeGlobalMonthData(month, year)
  const entry: CacheEntry = { ts: Date.now(), data }
  memCache.set(key, entry)
  writeLs(key, entry)
  return { data, cachedAt: entry.ts, fromCache: false }
}

// Сброс кэша. Без аргументов — чистит всё (вызывается при закрытии/реверте смены,
// т.к. это меняет месячные агрегаты). С месяцем/годом — только конкретную запись.
export const invalidateGlobalMonthData = (month?: number, year?: number) => {
  if (month != null && year != null) {
    const key = keyOf(month, year)
    memCache.delete(key)
    removeLs(key)
    return
  }
  memCache.clear()
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    for (const k of keys) removeLs(k)
  } catch {
    // ignore
  }
}
