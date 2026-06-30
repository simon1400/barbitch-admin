import { useState } from 'react'

import { Select } from '../../../dashboard/components/Select'
import { useGlobalMonthData } from '../../../dashboard/hooks/useGlobalMonthData'
import { GlobalLineChart } from '../../charts/components/GlobalLineChart'
import { StatSection } from '../../components/StatSection'

export default function ChartsTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { data } = useGlobalMonthData(month, year)

  return (
    <>
      <div className="mb-6 flex justify-between items-center sticky top-0 z-40">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
      </div>

      <StatSection title="Графики" id="charts" defaultOpen>
        <div className="space-y-6">
          <GlobalLineChart
            data={data.daysResult}
            title="Услуги"
            lines={[{ dataKey: 'sum', stroke: '#e71e6e', name: 'Сумма' }]}
          />

          <GlobalLineChart
            data={data.dataMetrics}
            title="Записи"
            lines={[
              { dataKey: 'countPayed', stroke: '#e71e6e', name: 'Резервации' },
              { dataKey: 'countCanceled', stroke: '#161615', name: 'Отмены' },
              { dataKey: 'countNoshow', stroke: 'orange', name: 'Не пришли' },
            ]}
          />
        </div>
      </StatSection>
    </>
  )
}
