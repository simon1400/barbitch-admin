import { useMonthYear } from '../../../../hooks/useMonthYear'

import { Select } from '../../../dashboard/components/Select'
import { useGlobalMonthData } from '../../../dashboard/hooks/useGlobalMonthData'
import { GlobalLineChart } from '../../charts/components/GlobalLineChart'
import { StatSection } from '../../components/StatSection'
import { CHART } from '../../../../ui/chartColors'

export default function ChartsTab() {
  const { month, setMonth, year, setYear } = useMonthYear()
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
            lines={[{ dataKey: 'sum', stroke: CHART.brand, name: 'Сумма' }]}
          />

          <GlobalLineChart
            data={data.dataMetrics}
            title="Записи"
            lines={[
              { dataKey: 'countPayed', stroke: CHART.brand, name: 'Резервации' },
              { dataKey: 'countCanceled', stroke: CHART.ink, name: 'Отмены' },
              { dataKey: 'countNoshow', stroke: 'orange', name: 'Не пришли' },
            ]}
          />
        </div>
      </StatSection>
    </>
  )
}
