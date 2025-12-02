/* eslint-disable @typescript-eslint/no-explicit-any */
import { Container } from '../../../components/Container'
import { useEffect, useState } from 'react'

import { OwnerProtection } from '../components/OwnerProtection'

import { ChartsLoader } from './components/ChartsLoader'
import { GlobalLineChart } from './components/GlobalLineChart'
import { getGlobalStats } from './fetch/global'

const GlobalMonthStats = () => {
  const [data, setData] = useState([])
  const [totalResult, setTotalResult] = useState<number>(0)
  const [totalResultWithDph, setTotalResultWithDph] = useState<number>(0)
  const [totalFlow, setTotalFlow] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getGlobalStats()
      .then((res: any) => {
        setData(res.globalStats)
        setTotalResult(
          res.globalStats.reduce((sum: number, item: any) => sum + Number(item.result || 0), 0),
        )
        setTotalResultWithDph(
          res.globalStats.reduce((sum: number, item: any) => sum + Number(item.resultDph || 0), 0),
        )
        setTotalFlow(
          res.globalStats.reduce((sum: number, item: any) => sum + Number(item.flow || 0), 0),
        )
      })
      .finally(() => {
        // Минимальная задержка для показа прелоадера
        setTimeout(() => setIsLoading(false), 500)
      })
  }, [])

  if (isLoading) {
    return <ChartsLoader />
  }

  return (
    <OwnerProtection>
      <section className={'pb-20'}>
        <Container size={'lg'}>
          <div className={'mb-8 p-4 bg-white rounded-xl shadow-md'}>
            <h3 className={'md:text-md font-bold'}>
              <span>{'Общий оборот: '}</span>
              <span className={'text-primary'}>{`${totalFlow.toLocaleString()} Kč`}</span>
            </h3>
          </div>
          <div className={'mb-8 p-4 bg-white rounded-xl shadow-md'}>
            <h3 className={'md:text-md font-bold'}>
              <span>{'Общий результат: '}</span>
              <span className={'text-primary'}>{`${totalResult.toLocaleString()} Kč`}</span>
            </h3>
          </div>
          <div className={'mb-8 p-4 bg-white rounded-xl shadow-md'}>
            <h3 className={'md:text-md font-bold'}>
              <span>{'Общий результат c DPH: '}</span>
              <span className={'text-primary'}>{`${totalResultWithDph.toLocaleString()} Kč`}</span>
            </h3>
          </div>

          <div className={'space-y-8'}>
            <GlobalLineChart
              data={data}
              title={'Результат'}
              lines={[
                { dataKey: 'result', stroke: 'green', name: 'Результат без DPH', strokeWidth: 3 },
                { dataKey: 'resultDph', stroke: 'blue', name: 'Результат c DPH', strokeWidth: 3 }
              ]}
            />
            <GlobalLineChart
              data={data}
              title={'Общая статистика'}
              lines={[
                { dataKey: 'flow', stroke: 'green', name: 'Оборот' },
                { dataKey: 'allCosts', stroke: 'red', name: 'Все затраты' },
                { dataKey: 'allCostsWhithotAdmins', stroke: 'blue', name: 'Затраты без админов' },
                { dataKey: 'costs', stroke: 'purple', name: 'Затраты на салон' },
              ]}
            />
            <GlobalLineChart
              data={data}
              title={'Затраты на сотрудников'}
              lines={[
                { dataKey: 'masters', stroke: 'orange', name: 'Затраты мастера' },
                { dataKey: 'admins', stroke: 'purple', name: 'Затраты админы' },
              ]}
            />
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default GlobalMonthStats
