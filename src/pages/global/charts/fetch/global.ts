import { getAdminsHours } from '../../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../../dashboard/fetch/allWorks'
import { getMoney } from '../../../dashboard/fetch/costs'
import { getMonth } from 'date-fns'

export const getGlobalStats = async () => {
  const globalStats = []
  const currentMonth = getMonth(new Date())
  for (let i = 2; i <= currentMonth; i++) {
    const dataAllWorks = await getAllWorks(i)
    const dataCosts = await getMoney(i)
    const dataAdmin = await getAdminsHours(i)
    const item = {
      date: i + 1,
      flow: dataAllWorks.globalFlow,
      costs: dataCosts.sumNoDphCosts,
      masters: dataAllWorks.sumMasters,
      allCostsWhithotAdmins: dataCosts.sumNoDphCosts + dataAllWorks.sumMasters,
      allCosts: dataCosts.sumNoDphCosts + dataAllWorks.sumMasters + dataAdmin.sumAdmins,
      admins: dataAdmin.sumAdmins,
      result: (
        dataCosts.cashMoney +
        (dataCosts.cardMoney + dataCosts.qrMoney + dataCosts.cardExtraIncome) / 1.21 -
        dataAllWorks.sumMasters -
        dataAdmin.sumAdmins -
        dataCosts.sumNoDphCosts
      ).toFixed(2),
      resultDph: (
        dataCosts.cashMoney +
        dataCosts.cardMoney + 
        dataCosts.qrMoney + 
        dataCosts.cardExtraIncome -
        dataAllWorks.sumMasters -
        dataAdmin.sumAdmins -
        dataCosts.sumCosts
      ).toFixed(2),
    }
    globalStats.push(item)
  }

  return {
    globalStats,
  }
}
