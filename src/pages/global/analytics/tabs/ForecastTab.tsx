import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { RevenueBarChart } from '../components/RevenueBarChart'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getForecast, type ForecastData } from '../fetch/forecast'

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

export default function ForecastTab() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getForecast(force))
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="text-gray-500 py-8 text-center">Načítání…</div>
  if (error || !data) return <div className="text-red-600 py-8 text-center">{error}</div>

  const tempo = data.prevMonthToSameDay
    ? Math.round((data.actualToDate / data.prevMonthToSameDay - 1) * 100)
    : null
  // прогнозы сравниваются с ИТОГОМ прошлого месяца (оба — оценка целого месяца;
  // сравнение с «той же датой» тут было бы нечестным: целый месяц vs часть)
  const runRateVsPrev = data.prevMonthTotal
    ? Math.round((data.forecastRunRate / data.prevMonthTotal - 1) * 100)
    : null
  const bookedVsPrev = data.prevMonthTotal
    ? Math.round((data.forecastBooked / data.prevMonthTotal - 1) * 100)
    : null
  const monthProgress = Math.round((data.daysPassed / data.daysTotal) * 100)

  const PctBadge = ({ pct }: { pct: number }) => (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
        pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {pct >= 0 ? `+${pct} %` : `${pct} %`}
    </span>
  )

  return (
    <>
      <StatSection title={`Прогноз — ${data.monthLabel}`} id="forecast" defaultOpen>
        <p className="text-xs text-gray-400 mb-4">
          Суммы = цены броней (без скидок/допродаж) — оценка темпа, не касса.
        </p>
        {/* Герой-блок: формула прогноза */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-500">
              День {data.daysPassed} из {data.daysTotal}
            </span>
            <span className="text-xs text-gray-400">{monthProgress} % месяца прошло</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full mb-6">
            <div
              className="h-2 bg-primary rounded-full"
              style={{ width: `${monthProgress}%` }}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-gray-400 mb-1">Факт (визиты)</div>
              <div className="text-2xl font-bold text-blue-gray-900">
                {fmtMoney(data.actualToDate)}
              </div>
              <div className="text-xs text-gray-400">{data.visitsToDate} визитов</div>
            </div>
            <div className="text-2xl text-gray-300 font-light">+</div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-gray-400 mb-1">Забронировано до конца</div>
              <div className="text-2xl font-bold text-blue-gray-900">
                {fmtMoney(data.futureBooked)}
              </div>
              <div className="text-xs text-gray-400">{data.futureVisits} броней</div>
            </div>
            <div className="text-2xl text-gray-300 font-light">=</div>
            <div className="flex-1 min-w-[180px] bg-primary/5 border-2 border-primary rounded-lg p-3">
              <div className="text-xs text-primary font-semibold mb-1">Прогноз минимум</div>
              <div className="text-3xl font-bold text-primary flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">{fmtMoney(data.forecastBooked)}</span>
                {bookedVsPrev !== null && <PctBadge pct={bookedVsPrev} />}
              </div>
              <div className="text-xs text-gray-400">
                без новых записей · % против итога прошлого месяца
              </div>
            </div>
          </div>
        </div>

        {/* Ровная сетка вторичных показателей */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прогноз по текущему темпу</div>
            <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2">
              <span className="whitespace-nowrap">{fmtMoney(data.forecastRunRate)}</span>
              {runRateVsPrev !== null && <PctBadge pct={runRateVsPrev} />}
            </div>
            <div className="text-xs text-gray-400 mt-1">факт ÷ дни × все дни · % против итога прошлого месяца</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прошлый месяц на эту дату</div>
            <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2">
              <span className="whitespace-nowrap">{fmtMoney(data.prevMonthToSameDay)}</span>
              {tempo !== null && <PctBadge pct={tempo} />}
            </div>
            <div className="text-xs text-gray-400 mt-1">сравнение темпа</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прошлый месяц (итог)</div>
            <div className="text-2xl font-bold text-blue-gray-900">
              {fmtMoney(data.prevMonthTotal)}
            </div>
            <div className="text-xs text-gray-400 mt-1">выручка по броням</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Затраты месяца</div>
            <div className="text-2xl font-bold text-blue-gray-900">
              {fmtMoney(data.expensesMonth)}
            </div>
            <div className="text-xs text-gray-400 mt-1">из коллекции Затраты</div>
          </div>
        </div>
      </StatSection>

      <StatSection title="Выручка по броням за последние месяцы" id="forecast-history">
        <div className="mb-6">
          <RevenueBarChart data={data.history} />
        </div>
        <TableWrapper>
          <table className="w-full text-left table-auto min-w-max">
            <thead>
              <tr>
                <Cell title="Месяц" asHeader />
                <Cell title="Визитов" asHeader />
                <Cell title="Выручка по броням" asHeader />
              </tr>
            </thead>
            <tbody>
              {data.history.map((h, i) => {
                const prev = i > 0 ? data.history[i - 1] : null
                const mom =
                  prev && prev.revenue ? Math.round((h.revenue / prev.revenue - 1) * 100) : null
                return (
                  <tr key={h.month} className="hover:bg-gray-50 transition-colors">
                    <Cell title={h.label} className="font-medium" />
                    <Cell title={String(h.visits)} />
                    <td className="p-4 border-b border-blue-gray-50">
                      <span className="flex items-center gap-2 font-sans text-sm font-medium text-primary">
                        <span className="whitespace-nowrap">{fmtMoney(h.revenue)}</span>
                        {mom !== null && <PctBadge pct={mom} />}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrapper>
      </StatSection>
    </>
  )
}
