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
    advances: filterByMonth(data.advances, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    salaries: filterByMonth(data.salaries, 'date').sort(
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
    advances: filterByMonth(masterData.advances, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    extraProfits: filterByMonth(masterData.extraProfits, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
    salaries: filterByMonth(masterData.salaries, 'date').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
  }
}

export const buildPayments = (filteredData: ReturnType<typeof selectMonthly>) => {
  const payments: Payment[] = [
    ...filteredData.advances.map((a) => ({ ...a, type: 'advance' as const })),
    ...filteredData.salaries.map((s) => ({ ...s, type: 'salary' as const })),
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
