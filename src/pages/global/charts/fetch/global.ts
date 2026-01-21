import { getAdminsHours } from '../../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../../dashboard/fetch/allWorks'
import { getMoney } from '../../../dashboard/fetch/costs'
import { getMonth } from 'date-fns'

export const getGlobalStats = async () => {
  const globalStats = []
  const currentYear = new Date().getFullYear()
  const currentMonth = getMonth(new Date())
  const startYear = 2024 // Год начала ведения системы
  const startMonth = 11 // Месяц начала (11 = декабрь)

  // Проходим по всем годам с начала ведения системы
  for (let year = startYear; year <= currentYear; year++) {
    // Определяем с какого месяца начинать и до какого идти для каждого года
    const beginMonth = year === startYear ? startMonth : 0
    const endMonth = year === currentYear ? currentMonth : 11

    for (let i = beginMonth; i <= endMonth; i++) {
      const dataAllWorks = await getAllWorks(i, year)
      const dataCosts = await getMoney(i, year)
      const dataAdmin = await getAdminsHours(i, year)
      const item = {
        date: `${i + 1}/${year}`,
        flow: dataAllWorks.globalFlow,
        costs: dataCosts.sumNoDphCosts,
        masters: dataAllWorks.sumMasters,
        allCostsWhithotAdmins: dataCosts.sumNoDphCosts + dataAllWorks.sumMasters,
        allCosts: dataCosts.sumNoDphCosts + dataAllWorks.sumMasters + dataAdmin.sumAdmins,
        admins: dataAdmin.sumAdmins,
        result: Math.round(
          dataCosts.cashMoney +
          (dataCosts.cardMoney + dataCosts.qrMoney + dataCosts.cardExtraIncome) / 1.21 -
          dataAllWorks.sumMasters -
          dataAdmin.sumAdmins -
          dataCosts.sumNoDphCosts
        ),
        resultDph: Math.round(
          dataCosts.cashMoney +
          dataCosts.cardMoney +
          dataCosts.qrMoney +
          dataCosts.cardExtraIncome -
          dataAllWorks.sumMasters -
          dataAdmin.sumAdmins -
          dataCosts.sumCosts
        ),
      }
      globalStats.push(item)
    }
  }

  return {
    globalStats,
  }
}
