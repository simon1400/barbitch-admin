import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { RevenueBarChart } from '../components/RevenueBarChart'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getForecast, type ForecastData } from '../fetch/forecast'

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

// Прирост в % против базы; null когда база 0 (сравнивать не с чем)
const growthPct = (cur: number, base: number): number | null =>
  base > 0 ? Math.round((cur / base - 1) * 100) : null

const PctBadge = ({ pct, title }: { pct: number; title?: string }) => (
  <span
    title={title}
    className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap cursor-default ${
      pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}
  >
    {pct >= 0 ? `+${pct} %` : `${pct} %`}
  </span>
)

// Рост от ×3 (+200 %) показываем множителем «×11,7» — проценты вроде «+1073 %»
// нечитаемы. База сравнения — в title-тултипе.
const fmtFactor = (cur: number, base: number) =>
  `×${(cur / base).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}`

const GrowthBadge = ({ cur, base, title }: { cur: number; base: number; title?: string }) => {
  const p = growthPct(cur, base)
  if (p === null) return null
  if (p >= 200) {
    return (
      <span
        title={title}
        className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap cursor-default bg-green-100 text-green-700"
      >
        {fmtFactor(cur, base)}
      </span>
    )
  }
  return <PctBadge pct={p} title={title} />
}

const PERIOD_PRESETS = [3, 6, 12]

export default function ForecastTab() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodN, setPeriodN] = useState<number | 'all'>(6)

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

  const tempo = growthPct(data.actualToDate, data.prevMonthToSameDay)
  // прогнозы сравниваются с ИТОГОМ прошлого месяца (оба — оценка целого месяца;
  // сравнение с «той же датой» тут было бы нечестным: целый месяц vs часть)
  const runRateVsPrev = growthPct(data.forecastRunRate, data.prevMonthTotal)
  const bookedVsPrev = growthPct(data.forecastBooked, data.prevMonthTotal)
  const monthProgress = Math.round((data.daysPassed / data.daysTotal) * 100)
  const vsPrevTitle = `против итога прошлого месяца: ${fmtMoney(data.prevMonthTotal)}`

  // ---- Динамика за период (история = все полные месяцы, срез выбирается кнопками) ----
  const history = data.history
  const period = periodN === 'all' ? history : history.slice(-periodN)
  const prevPeriod = periodN === 'all' ? [] : history.slice(-2 * periodN, -periodN)
  // сравнивать периоды честно можно только когда предыдущий период ПОЛНЫЙ (та же длина)
  const hasPrevPeriod = periodN !== 'all' && prevPeriod.length === periodN
  const periodRevenue = period.reduce((a, h) => a + h.revenue, 0)
  const periodVisits = period.reduce((a, h) => a + h.visits, 0)
  const prevRevenue = prevPeriod.reduce((a, h) => a + h.revenue, 0)
  const prevVisits = prevPeriod.reduce((a, h) => a + h.visits, 0)
  const first = period[0]
  const last = period[period.length - 1]
  const periodGrowth = period.length >= 2 && first ? growthPct(last.revenue, first.revenue) : null
  const avgMonthRevenue = period.length ? Math.round(periodRevenue / period.length) : 0
  const periodLabel = first && last ? `${first.label} — ${last.label}` : ''

  return (
    <>
      <StatSection title={`Прогноз — ${data.monthLabel}`} id="forecast" defaultOpen>
        <div className="flex items-start justify-between gap-4 mb-4">
          <p className="text-xs text-gray-400">
            Суммы = цены броней (без скидок/допродаж) — оценка темпа, не касса.
          </p>
          <button
            onClick={() => load(true)}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            ↻ Обновить
          </button>
        </div>
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
              <div className="text-xs text-gray-400 mb-1">Уже заработано (факт)</div>
              <div className="text-2xl font-bold text-blue-gray-900">
                {fmtMoney(data.actualToDate)}
              </div>
              <div className="text-xs text-gray-400">{data.visitsToDate} визитов с 1-го числа</div>
            </div>
            <div className="text-2xl text-gray-300 font-light">+</div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-gray-400 mb-1">Забронировано до конца</div>
              <div className="text-2xl font-bold text-blue-gray-900">
                {fmtMoney(data.futureBooked)}
              </div>
              <div className="text-xs text-gray-400">{data.futureVisits} активных броней</div>
            </div>
            <div className="text-2xl text-gray-300 font-light">=</div>
            <div className="flex-1 min-w-[180px] bg-pink-50 border-2 border-primary rounded-lg p-3">
              <div className="text-xs text-primary font-semibold mb-1">Прогноз минимум</div>
              <div className="text-3xl font-bold text-primary flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">{fmtMoney(data.forecastBooked)}</span>
                {bookedVsPrev !== null && <PctBadge pct={bookedVsPrev} title={vsPrevTitle} />}
              </div>
              <div className="text-xs text-gray-400">
                если новых записей не будет · % к итогу прошлого месяца
              </div>
            </div>
          </div>
        </div>

        {/* Ровная сетка вторичных показателей */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прогноз по темпу записей</div>
            <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2">
              <span className="whitespace-nowrap">{fmtMoney(data.forecastRunRate)}</span>
              {runRateVsPrev !== null && <PctBadge pct={runRateVsPrev} title={vsPrevTitle} />}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              если визиты идут тем же темпом: факт ÷ {data.daysPassed} дн × {data.daysTotal} дн
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прошлый месяц на эту же дату</div>
            <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2">
              <span className="whitespace-nowrap">{fmtMoney(data.prevMonthToSameDay)}</span>
              {tempo !== null && (
                <PctBadge
                  pct={tempo}
                  title={`наш факт ${fmtMoney(data.actualToDate)} против ${fmtMoney(data.prevMonthToSameDay)} к ${data.daysPassed}-му дню прошлого месяца`}
                />
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              к {data.daysPassed}-му дню · зелёный % = идём быстрее прошлого месяца
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Прошлый месяц (итог)</div>
            <div className="text-2xl font-bold text-blue-gray-900">
              {fmtMoney(data.prevMonthTotal)}
            </div>
            <div className="text-xs text-gray-400 mt-1">вся выручка по броням за месяц</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">Затраты месяца</div>
            <div className="text-2xl font-bold text-blue-gray-900">
              {fmtMoney(data.expensesMonth)}
            </div>
            <div className="text-xs text-gray-400 mt-1">из коллекции «Затраты» (текущий месяц)</div>
          </div>
        </div>
      </StatSection>

      <StatSection title="Динамика за период" id="forecast-history">
        {/* Выбор периода: срез общей истории полных месяцев */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {PERIOD_PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => setPeriodN(n)}
              disabled={history.length < n}
              title={history.length < n ? `данных только за ${history.length} мес` : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                periodN === n
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {n} мес
            </button>
          ))}
          <button
            onClick={() => setPeriodN('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              periodN === 'all'
                ? 'bg-primary text-white border-primary'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Всё время ({history.length} мес)
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {periodLabel} · только полные месяцы (текущий не входит)
        </p>

        {period.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">Нет данных за период</div>
        ) : (
          <>
            {/* Сводка прироста за период */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-xs text-gray-400 mb-1">Выручка за период</div>
                <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2 flex-wrap">
                  <span className="whitespace-nowrap">{fmtMoney(periodRevenue)}</span>
                  {hasPrevPeriod && (
                    <GrowthBadge
                      cur={periodRevenue}
                      base={prevRevenue}
                      title={`против предыдущих ${periodN} мес: ${fmtMoney(prevRevenue)}`}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {hasPrevPeriod
                    ? `пред. ${periodN} мес: ${fmtMoney(prevRevenue)}`
                    : 'сравнить не с чем — не хватает истории'}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-xs text-gray-400 mb-1">Визитов за период</div>
                <div className="text-2xl font-bold text-blue-gray-900 flex items-center gap-2 flex-wrap">
                  <span>{periodVisits}</span>
                  {hasPrevPeriod && (
                    <GrowthBadge
                      cur={periodVisits}
                      base={prevVisits}
                      title={`против предыдущих ${periodN} мес: ${prevVisits} визитов`}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  в среднем {Math.round(periodVisits / period.length)} в месяц
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-xs text-gray-400 mb-1">Прирост за период</div>
                <div
                  className={`text-2xl font-bold ${
                    periodGrowth === null
                      ? 'text-blue-gray-900'
                      : periodGrowth >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                  }`}
                >
                  {periodGrowth === null
                    ? '—'
                    : periodGrowth >= 200 && first && last
                      ? fmtFactor(last.revenue, first.revenue)
                      : `${periodGrowth >= 0 ? '+' : ''}${periodGrowth} %`}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {periodGrowth !== null && periodGrowth >= 200
                    ? `месячная выручка: ${first?.label} → ${last?.label} (во столько раз больше)`
                    : `${first?.label} → ${last?.label} (по месячной выручке)`}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-xs text-gray-400 mb-1">Средний месяц</div>
                <div className="text-2xl font-bold text-blue-gray-900">
                  {fmtMoney(avgMonthRevenue)}
                </div>
                <div className="text-xs text-gray-400 mt-1">выручка ÷ {period.length} мес</div>
              </div>
            </div>

            <div className="mb-2">
              <RevenueBarChart data={period} />
            </div>
            <p className="text-xs text-gray-400 mb-6">
              Линия — выручка по броням; визиты видны при наведении и в таблице ниже.
            </p>

            <TableWrapper>
              <table className="w-full text-left table-auto min-w-max">
                <thead>
                  <tr>
                    <Cell title="Месяц" asHeader />
                    <Cell title="Визитов" asHeader />
                    <Cell title="Выручка по броням" asHeader />
                    <Cell title="К пред. месяцу" asHeader />
                    <Cell title="К началу периода" asHeader />
                  </tr>
                </thead>
                <tbody>
                  {period.map((h, i) => {
                    // MoM первой строки периода считается против месяца ДО периода (из общей истории)
                    const histIdx = history.length - period.length + i
                    const prevRow = histIdx > 0 ? history[histIdx - 1] : null
                    return (
                      <tr key={h.month} className="hover:bg-gray-50 transition-colors">
                        <Cell title={h.label} className="font-medium" />
                        <Cell title={String(h.visits)} />
                        <td className="p-4 border-b border-blue-gray-50">
                          <span className="font-sans text-sm font-medium text-primary whitespace-nowrap">
                            {fmtMoney(h.revenue)}
                          </span>
                        </td>
                        <td className="p-4 border-b border-blue-gray-50">
                          {prevRow && prevRow.revenue > 0 ? (
                            <GrowthBadge
                              cur={h.revenue}
                              base={prevRow.revenue}
                              title={`${prevRow.label}: ${fmtMoney(prevRow.revenue)}`}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="p-4 border-b border-blue-gray-50">
                          {i > 0 && first && first.revenue > 0 ? (
                            <GrowthBadge
                              cur={h.revenue}
                              base={first.revenue}
                              title={`против ${first.label}: ${fmtMoney(first.revenue)}`}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <Cell title="Итого" className="font-bold" />
                    <Cell title={String(periodVisits)} className="font-bold" />
                    <td className="p-4 border-b border-blue-gray-50">
                      <span className="font-sans text-sm font-bold text-primary whitespace-nowrap">
                        {fmtMoney(periodRevenue)}
                      </span>
                    </td>
                    <td className="p-4 border-b border-blue-gray-50" />
                    <td className="p-4 border-b border-blue-gray-50" />
                  </tr>
                </tbody>
              </table>
            </TableWrapper>
            <p className="text-xs text-gray-400 mt-3">
              «К пред. месяцу» — изменение против предыдущего месяца. «К началу периода» — против
              первого месяца периода ({first?.label}); ×N = во столько раз месяц больше.
              {periodN === 'all' &&
                ' База «Всё время» — месяц открытия салона с маленькой выручкой, поэтому множители такие большие.'}
            </p>
          </>
        )}
      </StatSection>
    </>
  )
}
