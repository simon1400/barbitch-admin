import { useCallback, useState } from 'react'

import { BlocksContent } from '../../dashboard/components/BlocksContent'
import { useGlobalWeekData } from '../../dashboard/hooks/useGlobalWeekData'
import { WeekSelector } from '../../dashboard/components/WeekSelector'

export const WeeklySection = () => {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()

  const data = useGlobalWeekData({
    startDate,
    endDate,
  })

  const handleWeekChange = useCallback((newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
  }, [])

  // Вычисляем средние значения за день
  const daysCount = data.daysResult.length || 7
  const avgPerDay = {
    flow: Math.round(data.globalFlow / daysCount),
    admins: Math.round(data.sumAdmins / daysCount),
    clients: Math.round(data.sumClientsDone / daysCount),
  }

  return (
    <div className={'space-y-8'}>
      {/* Week Selector */}
      <div className={'flex justify-between items-center flex-wrap gap-4'}>
        <WeekSelector onWeekChange={handleWeekChange} currentWeekRange={data.weekRange} />
      </div>

      {/* Weekly Averages */}
      <div>
        <BlocksContent
          items={[
            {
              title: 'Средний чек',
              value: `${data.averageCheck.toLocaleString()} Kč`,
            },
            {
              title: 'Средний поток/день',
              value: `${avgPerDay.flow.toLocaleString()} Kč`,
            },
            {
              title: 'Средняя з/п мастеров/услуга',
              value: `${data.averageMasterSalary.toLocaleString()} Kč`,
            },
            {
              title: 'Средняя з/п админов/день',
              value: `${avgPerDay.admins.toLocaleString()} Kč`,
            },
            {
              title: 'Средний клиентов/день',
              value: avgPerDay.clients,
            },
            {
              title: 'Обслужено клиентов',
              value: data.sumClientsDone,
            },
          ]}
        />
      </div>
    </div>
  )
}
