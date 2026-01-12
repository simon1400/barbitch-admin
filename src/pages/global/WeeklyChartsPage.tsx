import { Container } from '../../components/Container'
import { useState } from 'react'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'
import { GlobalLineChart } from './charts/components/GlobalLineChart'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'

const WeeklyChartsPage = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const data = useGlobalMonthData(month, year)

  return (
    <OwnerProtection>
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6 flex justify-between items-center sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Недельные графики</h2>
          </div>

          {/* Charts Section */}
          <StatSection title={'Графики'} id={'charts'} defaultOpen>
            <div className={'space-y-6'}>
              <GlobalLineChart
                data={data.daysResult}
                title={'Услуги'}
                lines={[{ dataKey: 'sum', stroke: '#e71e6e', name: 'Сумма' }]}
              />

              <GlobalLineChart
                data={data.dataMetrics}
                title={'Записи'}
                lines={[
                  { dataKey: 'countPayed', stroke: '#e71e6e', name: 'Резервации' },
                  { dataKey: 'countCanceled', stroke: '#161615', name: 'Отмены' },
                  { dataKey: 'countNoshow', stroke: 'orange', name: 'Не пришли' },
                ]}
              />
            </div>
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default WeeklyChartsPage
