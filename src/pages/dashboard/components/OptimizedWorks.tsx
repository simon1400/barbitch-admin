import type { IDataWorks, IExtraProfitItem } from '../fetch/works'

import {
  cardPadCls,
  h1Cls,
  kickerCls,
  pageShellCls,
} from '../../../ui/kit'
import { useAppContext } from '../../../context/AppContext'
import { formatDate } from '../../../utils/parseDate'
import { useCallback, useEffect, useState, useMemo } from 'react'

import { blockStatsItems } from '../data'
import { getWorks } from '../fetch/works'

import { BlocksContent } from './BlocksContent'
import { Cell } from './Cell'
import { Select } from './Select'
import { GlobalLineChart } from '../../global/charts/components/GlobalLineChart'
import { TableWrapper } from '../../global/components/TableWrapper'

const OptimizedWorks = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [data, setData] = useState<IDataWorks>()
  const [salary, setSalary] = useState<number>(0)
  const [extraProfit, setExtraProfit] = useState<number>(0)
  const [extraProfits, setExtraProfits] = useState<IExtraProfitItem[]>([])
  const [payrolls, setPayrolls] = useState<number>(0)
  const [penalty, setPenalty] = useState<number>(0)
  const [result, setResult] = useState<number>(0)
  const [tipSum, setTipSum] = useState<number>(0)
  const [chartData, setChartData] = useState<Array<{ date: string; countPayed: number; countCanceled: number; countNoshow: number }>>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const { adminName } = useAppContext()

  // Fallback данные для графика на основе услуг (если нет noonaEmployeeId)
  const fallbackChartData = useMemo(() => {
    if (!data?.offersDone || data.offersDone.length === 0) return []

    // Группируем услуги по дате
    const countByDate = new Map<string, number>()

    for (const offer of data.offersDone) {
      const d = new Date(offer.date)
      const day = String(d.getDate()).padStart(2, '0')
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const formatted = `${day}.${m}`

      countByDate.set(formatted, (countByDate.get(formatted) || 0) + 1)
    }

    // Создаём массив для всех дней месяца
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const result = []

    for (let day = 1; day <= daysInMonth; day++) {
      const d = String(day).padStart(2, '0')
      const m = String(month + 1).padStart(2, '0')
      const formatted = `${d}.${m}`

      result.push({
        date: formatted,
        countPayed: countByDate.get(formatted) || 0,
        countCanceled: 0,
        countNoshow: 0,
      })
    }

    return result
  }, [data, month, year])

  // Используем данные из Noona если есть, иначе fallback
  const displayChartData = chartData.length > 0 ? chartData : fallbackChartData

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { works, salary, extraProfit, extraProfits, payrolls, penalty, result, tipSum, chartData: noonaChartData } = await getWorks(
        adminName,
        month,
        year,
      )
      setData(works)
      setSalary(salary)
      setExtraProfit(extraProfit)
      setExtraProfits(extraProfits)
      setPayrolls(payrolls)
      setPenalty(penalty)
      setResult(result)
      setTipSum(tipSum)
      setChartData(noonaChartData)
    } finally {
      setIsLoading(false)
    }
  }, [adminName, month, year])

  useEffect(() => {
    if (adminName) {
      loadData()
    }
  }, [month, loadData, adminName])

  if (isLoading) {
    return (
      <div className={pageShellCls}>
        <div className={'py-12 text-center text-[13px] font-semibold text-[#a39e99]'}>
          {'Načítání dat...'}
        </div>
      </div>
    )
  }

  return (
    <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>{'Главная'}</h1>

        {/* Stats Grid */}
        <div className={cardPadCls}>
        <BlocksContent
          items={blockStatsItems(
            salary,
            data?.offersDone.length || 0,
            extraProfit,
            payrolls,
            penalty,
            tipSum,
          )}
        />
        </div>

        {/* Výsledek za měsíc — акцент-карточка (розовый тинт вместо градиента) */}
        <div className={'bg-[#fce7f0] border border-[#f0a8c8] rounded-xl px-6 py-5 mb-3.5'}>
          <div
            className={
              'text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#b81b60] mb-[5px]'
            }
          >
            {'Výsledek za měsíc'}
          </div>
          <div className={'text-[26px] font-extrabold text-[#b81b60] leading-[1.15]'}>
            {result.toLocaleString()} {'Kč'}
          </div>
        </div>

        {/* Chart Section - показываем только если есть услуги */}
        {data?.offersDone && data.offersDone.length > 0 && (
          <div className={'mb-3.5'}>
            <GlobalLineChart
              data={displayChartData}
              title={'Moje rezervace'}
              lines={[
                { dataKey: 'countPayed', stroke: '#e71e6e', name: 'Rezervace' },
                { dataKey: 'countCanceled', stroke: '#161615', name: 'Zrušené' },
                { dataKey: 'countNoshow', stroke: 'orange', name: 'Nepřišli' },
              ]}
            />
          </div>
        )}

        {/* Table Section */}
        <div className={cardPadCls}>
          <div className={'flex justify-between flex-col md:flex-row md:items-center gap-3 mb-3.5'}>
            <h2 className={'m-0 text-[15px] font-extrabold text-[#161615]'}>
              {'Historie prací'}
            </h2>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          </div>

          <div className={'relative flex flex-col w-full overflow-hidden'}>
            {data?.offersDone && data.offersDone.length > 0 ? (
              <div className={'relative w-full overflow-x-auto'}>
                <table className={'w-full text-left min-w-[620px]'}>
                  <thead>
                    <tr>
                      <Cell title={'#'} asHeader className={'hidden md:table-cell'} />
                      <Cell title={'Datum'} asHeader />
                      <Cell title={'Jméno klienta'} asHeader />
                      <Cell title={'Peníze'} asHeader />
                      <Cell title={'Spropitné'} asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {data.offersDone.map((item, idx) => (
                      <tr key={item.id} className={'hover:bg-[#faf8f7] transition-colors'}>
                        <Cell title={`${idx + 1}.`} className={'hidden md:table-cell'} />
                        <Cell title={formatDate(item.date)} />
                        <Cell title={item.clientName} />
                        <Cell
                          title={`${item.staffSalaries} Kč`}
                          className={'font-semibold text-[#1d7a3f]'}
                        />
                        <Cell
                          title={item.tip?.length ? `${item.tip} Kč` : '—'}
                          className={item.tip?.length ? 'text-[#e71e6e]' : 'text-[#a39e99]'}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={'p-12 text-center'}>
                <svg
                  className={'w-14 h-14 mx-auto text-[#e0dbd7] mb-3'}
                  fill={'none'}
                  stroke={'currentColor'}
                  viewBox={'0 0 24 24'}
                >
                  <path
                    strokeLinecap={'round'}
                    strokeLinejoin={'round'}
                    strokeWidth={2}
                    d={
                      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    }
                  />
                </svg>
                <p className={'text-[#8b857f]'}>{'Žádné údaje za vybraný měsíc'}</p>
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {data?.offersDone && data.offersDone.length > 0 && (
            <div
              className={
                'pt-3 mt-1 flex flex-col md:flex-row justify-between md:items-center gap-2'
              }
            >
              <span className={'flex items-center gap-3 text-[13px] font-bold text-[#4c4844]'}>
                <span>{'Celkem prací: '}</span>
                <span className={'text-[18px] font-extrabold text-[#161615]'}>{data.offersDone.length}</span>
              </span>
              <span className={'text-[18px] font-extrabold text-[#b81b60]'}>
                {(salary + tipSum).toLocaleString()} {'Kč'}
              </span>
            </div>
          )}
        </div>

        {/* Přídavný výdělek — расшифровка каждой премии (как у администраторов) */}
        {extraProfits.length > 0 && (
          <div className={cardPadCls}>
            <h2 className={'m-0 mb-3.5 text-[15px] font-extrabold text-[#161615]'}>{'Přídavný výdělek'}</h2>
            <TableWrapper
              totalSum={`${extraProfit.toLocaleString()} Kč`}
              totalLabel={'Celkem přídavný výdělek'}
            >
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Datum'} asHeader />
                    <Cell title={'Částka'} asHeader />
                    <Cell title={'Komentář'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {extraProfits.map((bonus) => (
                    <tr key={bonus.id} className={'hover:bg-[#faf8f7] transition-colors'}>
                      <Cell title={formatDate(bonus.date)} />
                      <Cell
                        title={`+${Number(bonus.sum).toLocaleString()} Kč`}
                        className={'text-[#1d7a3f] font-semibold'}
                      />
                      <Cell title={bonus.title || '-'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </div>
        )}
    </div>
  )
}

export default OptimizedWorks
