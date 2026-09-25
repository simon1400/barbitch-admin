
import type { GroupedSum } from '../fetch/fetchHelpers'

import { useCallback, useEffect, useState } from 'react'

import { ym } from '../../../utils/date'
import { getCurrentWeekRange } from '../../../utils/getWeekRange'
import { getAdminsHoursByDateRange } from '../fetch/allAdminsHours'
import { getAllWorksByDateRange } from '../fetch/allWorks'
import { fetchManagersFixedForRange } from '../fetch/managerRates'
import { splitTeam } from '../fetch/teamSplit'

interface WeekDataParams {
  startDate?: Date
  endDate?: Date
  useCurrentWeek?: boolean
}

export const useGlobalWeekData = (params: WeekDataParams = {}) => {
  const { startDate, endDate } = params

  const [data, setData] = useState({
      sumClientsDone: 0,
      globalFlow: 0,
      sumAdmins: 0,
      averageCheck: 0,
      averageMasterSalary: 0,
      daysResult: [] as GroupedSum[],
      weekRange: { firstDay: new Date(), lastDay: new Date() },
  })

  const loadData = useCallback(async () => {
    let firstDay: Date
    let lastDay: Date

    if (startDate && endDate) {
      firstDay = startDate
      lastDay = endDate
    } else {
      const weekRange = getCurrentWeekRange()
      firstDay = weekRange.firstDay
      lastDay = weekRange.lastDay
    }

    const [worksRes, adminsRes, managersFixed] = await Promise.all([
      getAllWorksByDateRange(firstDay, lastDay),
      getAdminsHoursByDateRange(firstDay, lastDay),
      // оклад управляющих — доля дней диапазона в своём месяце (s213)
      fetchManagersFixedForRange(firstDay, lastDay),
    ])

    // Совместителей убираем из «чистых» админов; их админ-часы добавляем как админ-расход
    // (з/п админов/день должна учитывать и совместителей, но без двойного учёта корректировок).
    const team = splitTeam(worksRes.summary, adminsRes.summary, ym(firstDay))

    setData({
        sumClientsDone: worksRes.sumClientsDone,
        globalFlow: worksRes.globalFlow,
        averageCheck: worksRes.averageCheck,
        averageMasterSalary: worksRes.averageMasterSalary,
        daysResult: worksRes.daysResult,
        sumAdmins: team.sumAdmins + team.combinedAdminEarnings + managersFixed,
        weekRange: { firstDay, lastDay },
    })
  }, [startDate, endDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { ...data, refetch: loadData }
}
