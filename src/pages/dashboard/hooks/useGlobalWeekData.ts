
import type { GroupedSum } from '../fetch/fetchHelpers'

import { useCallback, useEffect, useState } from 'react'

import { getCurrentWeekRange } from '../../../utils/getWeekRange'
import { getAdminsHoursByDateRange } from '../fetch/allAdminsHours'
import { getAllWorksByDateRange } from '../fetch/allWorks'

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

    const [worksRes, adminsRes] = await Promise.all([
      getAllWorksByDateRange(firstDay, lastDay),
      getAdminsHoursByDateRange(firstDay, lastDay),
    ])

    setData({
        sumClientsDone: worksRes.sumClientsDone,
        globalFlow: worksRes.globalFlow,
        averageCheck: worksRes.averageCheck,
        averageMasterSalary: worksRes.averageMasterSalary,
        daysResult: worksRes.daysResult,
        sumAdmins: adminsRes.sumAdmins,
        weekRange: { firstDay, lastDay },
    })
  }, [startDate, endDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { ...data, refetch: loadData }
}
