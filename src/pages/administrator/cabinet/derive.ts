/* eslint-disable @typescript-eslint/no-explicit-any */
// Выборки месяца и расчёт заработка мастера. Тела перенесены ДОСЛОВНО из
// useMemo страницы (этап 6): проверки на null остались в компоненте, сюда
// уехало только то, что считается.
//
// ⚠️ Две копии filterByMonth оставлены КАК БЫЛИ. Свести их — это дедуп, а не
// перенос; смешивать эти две правки в одном заходе нельзя, иначе
// дифференциальная проверка перестаёт отвечать на вопрос «я ничего не менял?».
import { parseMoney } from '../../../utils/money'
import type { AdministratorData, MasterData, Payment } from './types'

// s285: аванс и выплата засчитываются за месяц `period` («за какой месяц»), а не
// за месяц даты — владелец платит в следующем месяце за прошлый. У строк без
// периода (до s285) — месяц даты, как раньше. Штрафы/списания/премии — по дате.
const periodOf = (item: { period?: string | null; date: string }): string => {
  if (typeof item.period === 'string' && /^\d{4}-\d{2}$/.test(item.period)) return item.period
  const d = new Date(item.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const filterByPeriod = <T extends { period?: string | null; date: string }>(items: T[], month: number, year: number): T[] => {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  return items.filter((item) => periodOf(item) === key)
}

export const selectMonthly = (
  data: AdministratorData,
  selectedMonth: number,
  selectedYear: number,
) => {
  const filterByMonth = (items: any[], dateField: string) => {
    return items.filter((item) => {
      const itemDate = new Date(item[dateField])
      return itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear
    })
  }

  return {
    workTimes: filterByMonth(data.workTimes, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    penalties: filterByMonth(data.penalties, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    payrolls: filterByMonth(data.payrolls, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    advances: filterByPeriod(data.advances, selectedMonth, selectedYear).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    salaries: filterByPeriod(data.salaries, selectedMonth, selectedYear).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    extraProfits: filterByMonth(data.extraProfits, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
  }
}

export const selectMasterMonthly = (
  masterData: MasterData,
  selectedMonth: number,
  selectedYear: number,
) => {
  const filterByMonth = (items: any[], dateField: string) => {
    return items.filter((item) => {
      const itemDate = new Date(item[dateField])
      return itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear
    })
  }

  return {
    servicesProvided: filterByMonth(masterData.servicesProvided, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    penalties: filterByMonth(masterData.penalties, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    payrolls: filterByMonth(masterData.payrolls, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    advances: filterByPeriod(masterData.advances, selectedMonth, selectedYear).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    extraProfits: filterByMonth(masterData.extraProfits, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    salaries: filterByPeriod(masterData.salaries, selectedMonth, selectedYear).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
  }
}

export const buildPayments = (filteredData: ReturnType<typeof selectMonthly>) => {
  const payments: Payment[] = [
    ...filteredData.advances.map((a) => ({ ...a, period: periodOf(a), type: 'advance' as const })),
    ...filteredData.salaries.map((s) => ({ ...s, period: periodOf(s), type: 'salary' as const })),
  ]

  return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export const computeMasterEarnings = (
  filteredMasterData: ReturnType<typeof selectMasterMonthly>,
) => {
  const staffSalaries = filteredMasterData.servicesProvided.reduce(
    (sum, sp) => sum + parseMoney(sp.staffSalaries),
    0
  )
  const tips = filteredMasterData.servicesProvided.reduce(
    (sum, sp) => sum + parseMoney(sp.tip),
    0
  )
  // Результат мастера = только заработок за услуги + чаевые
  const totalResult = staffSalaries + tips

  return {
    staffSalaries,
    tips,
    result: totalResult,
    servicesCount: filteredMasterData.servicesProvided.length,
  }
}
