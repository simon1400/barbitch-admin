import { getGlobalMonthData, type GlobalMonthData } from '../../../dashboard/fetch/monthDataCache'

// Агрегация показателей «Финансового обзора»/«Резерваций» за ПРОИЗВОЛЬНЫЙ период
// (несколько месяцев). Все финансовые формулы в data.ts линейны по сырым полям,
// поэтому сумма месячных сырых полей = корректный итог периода. Переиспользует
// кэш getGlobalMonthData (месяцы, уже открытые на главной/в др. табах, мгновенны).

export interface MonthKey {
  month: number // 0..11
  year: number
}

// Все суммируемые сырые поля GlobalMonthData + перечисленные счётчики резерваций.
export interface GlobalStatsTotals {
  // финансы (вход для blockStateItems)
  noDphCosts: number
  globalFlow: number
  cashMoney: number
  cardMoney: number
  cardExtraIncome: number
  sumMasters: number
  sumAdmins: number
  payrollSum: number
  voucherRealized: number
  voucherPayed: number
  qrMoney: number
  extraMoney: number
  costs: number
  salonSalariesCash: number
  salonSalariesCard: number
  taxesSum: number
  sumCombined: number
  combinedAdminEarnings: number
  // резервации
  clientsAll: number
  clientsPayed: number
  clientsNoshow: number
  clientsCanceled: number
  clientsFixed: number
  sumClientsDone: number
  clientsPastPayed: number
  countCreatedMonthReservation: number
  // производное
  totalDays: number // суммарные «активные» дни периода (для индекса)
  reservationIndex: number // созданных резерваций в день (в среднем)
}

export interface MonthlyRow extends MonthKey {
  data: GlobalMonthData
}

export interface GlobalStatsResult {
  totals: GlobalStatsTotals
  rows: MonthlyRow[] // помесячная разбивка (по возрастанию даты)
  cachedAt: number // самый старый cachedAt из месяцев (грубая метка свежести)
}

// Сколько «активных» дней в месяце для индекса: текущий месяц — до сегодня,
// прошлый — все дни месяца, будущий — 0. Зеркало логики `day` в getEvents.ts.
const activeDaysForMonth = (month: number, year: number): number => {
  const today = new Date()
  if (today.getFullYear() === year && today.getMonth() === month) return today.getDate()
  // будущий месяц
  if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
    return 0
  }
  return new Date(year, month + 1, 0).getDate() // дней в прошлом месяце
}

const emptyTotals = (): GlobalStatsTotals => ({
  noDphCosts: 0,
  globalFlow: 0,
  cashMoney: 0,
  cardMoney: 0,
  cardExtraIncome: 0,
  sumMasters: 0,
  sumAdmins: 0,
  payrollSum: 0,
  voucherRealized: 0,
  voucherPayed: 0,
  qrMoney: 0,
  extraMoney: 0,
  costs: 0,
  salonSalariesCash: 0,
  salonSalariesCard: 0,
  taxesSum: 0,
  sumCombined: 0,
  combinedAdminEarnings: 0,
  clientsAll: 0,
  clientsPayed: 0,
  clientsNoshow: 0,
  clientsCanceled: 0,
  clientsFixed: 0,
  sumClientsDone: 0,
  clientsPastPayed: 0,
  countCreatedMonthReservation: 0,
  totalDays: 0,
  reservationIndex: 0,
})

// Список месяцев между from и to включительно (по возрастанию).
export const monthsInRange = (from: MonthKey, to: MonthKey): MonthKey[] => {
  const out: MonthKey[] = []
  let y = from.year
  let m = from.month
  // защита от перепутанных границ
  if (to.year < from.year || (to.year === from.year && to.month < from.month)) return [to, from]
  while (y < to.year || (y === to.year && m <= to.month)) {
    out.push({ month: m, year: y })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return out
}

// Последние n месяцев включая текущий (по возрастанию).
export const lastNMonths = (n: number): MonthKey[] => {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  return monthsInRange(
    { month: from.getMonth(), year: from.getFullYear() },
    { month: now.getMonth(), year: now.getFullYear() },
  )
}

export const getGlobalStatsRange = async (
  months: MonthKey[],
  force = false,
): Promise<GlobalStatsResult> => {
  const results = await Promise.all(
    months.map(async (mk) => {
      const res = await getGlobalMonthData(mk.month, mk.year, force)
      return { ...mk, data: res.data, cachedAt: res.cachedAt }
    }),
  )

  const totals = emptyTotals()
  let oldestCachedAt = Date.now()

  for (const r of results) {
    const d = r.data
    totals.noDphCosts += d.noDphCosts
    totals.globalFlow += d.globalFlow
    totals.cashMoney += d.cashMoney
    totals.cardMoney += d.cardMoney
    totals.cardExtraIncome += d.cardExtraIncome
    totals.sumMasters += d.sumMasters
    totals.sumAdmins += d.sumAdmins
    totals.payrollSum += d.payrollSum
    totals.voucherRealized += d.voucherRealized
    totals.voucherPayed += d.voucherPayed
    totals.qrMoney += d.qrMoney
    totals.extraMoney += d.extraMoney
    totals.costs += d.costs
    totals.salonSalariesCash += d.salonSalariesCash
    totals.salonSalariesCard += d.salonSalariesCard
    totals.taxesSum += d.taxesSum
    totals.sumCombined += d.sumCombined
    totals.combinedAdminEarnings += d.combinedAdminEarnings
    totals.clientsAll += d.clients.all
    totals.clientsPayed += d.clients.payed
    totals.clientsNoshow += d.clients.noshow
    totals.clientsCanceled += d.clients.canceled
    totals.clientsFixed += d.clients.fixed
    totals.sumClientsDone += d.sumClientsDone
    totals.clientsPastPayed += d.clients.pastPayed
    // защита от старых записей кэша, где значение могло сохраниться строкой
    totals.countCreatedMonthReservation += Number(d.clients.countCreatedMonthReservation) || 0
    totals.totalDays += activeDaysForMonth(r.month, r.year)
    if (r.cachedAt && r.cachedAt < oldestCachedAt) oldestCachedAt = r.cachedAt
  }

  totals.reservationIndex =
    totals.totalDays > 0
      ? Math.round((totals.countCreatedMonthReservation / totals.totalDays) * 10) / 10
      : 0

  const rows: MonthlyRow[] = results.map((r) => ({ month: r.month, year: r.year, data: r.data }))

  return { totals, rows, cachedAt: oldestCachedAt }
}
