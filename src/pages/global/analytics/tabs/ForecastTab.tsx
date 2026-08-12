import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { RevenueBarChart } from '../components/RevenueBarChart'
import { TableWrapper } from '../../components/TableWrapper'
import { getForecast, type ForecastData } from '../fetch/forecast'
import {
  badgeNegCls,
  badgePosCls,
  btnNeutralCls,
  cardCls,
  cardPadCls,
  cardTitleCls,
  hintCls,
  mutedCls,
  pillCls,
  tileCls,
  tileLabelCls,
  tileSubCls,
} from '../../../../ui/kit'

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

// Прирост в % против базы; null когда база 0 (сравнивать не с чем)
const growthPct = (cur: number, base: number): number | null =>
  base > 0 ? Math.round((cur / base - 1) * 100) : null

const PctBadge = ({ pct, title }: { pct: number; title?: string }) => (
  <span
    title={title}
    className={`whitespace-nowrap cursor-default ${pct >= 0 ? badgePosCls : badgeNegCls}`}
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
      <span title={title} className={`whitespace-nowrap cursor-default ${badgePosCls}`}>
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

  if (loading)
    return <div className='py-12 text-center text-[13px] font-semibold text-[#a39e99]'>Načítání…</div>
  if (error || !data)
    return <div className='py-12 text-center text-[13px] font-semibold text-[#d61f61]'>{error}</div>

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
      {/* Верхняя строка: дисклеймер + обновить */}
      <div className='flex items-center justify-between gap-3 mb-3 flex-wrap'>
        <span className={mutedCls}>
          Суммы = цены броней (без скидок/допродаж) — оценка темпа, не касса.
        </span>
        <button onClick={() => load(true)} className={btnNeutralCls}>
          ↻ Обновить
        </button>
      </div>

      {/* Герой-карточка: формула прогноза */}
      <div className={cardPadCls}>
        <div className='flex items-center justify-between gap-3 mb-2'>
          <span className='text-[13px] font-bold text-[#4c4844]'>
            День {data.daysPassed} из {data.daysTotal}
          </span>
          <span className={mutedCls}>{monthProgress} % месяца прошло</span>
        </div>
        <div className='h-2 rounded-full bg-[#f2efec] overflow-hidden mb-5'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-[#e71e6e] to-[#ff759e]'
            style={{ width: `${monthProgress}%` }}
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-[1fr_20px_1fr_20px_1.2fr] gap-3 items-center'>
          <div>
            <div className={tileLabelCls}>Уже заработано (факт)</div>
            <div className='text-[22px] font-extrabold text-[#161615]'>
              {fmtMoney(data.actualToDate)}
            </div>
            <div className={tileSubCls}>{data.visitsToDate} визитов с 1-го числа</div>
          </div>
          <span className='text-[18px] font-bold text-[#c4bfba] text-center'>＋</span>
          <div>
            <div className={tileLabelCls}>Забронировано до конца</div>
            <div className='text-[22px] font-extrabold text-[#161615]'>
              {fmtMoney(data.futureBooked)}
            </div>
            <div className={tileSubCls}>{data.futureVisits} активных броней</div>
          </div>
          <span className='text-[18px] font-bold text-[#c4bfba] text-center'>＝</span>
          <div className='bg-[#fce7f0] border border-[#f0a8c8] rounded-[10px] px-4 py-[13px]'>
            <div className='text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#b81b60] mb-[5px]'>
              Прогноз минимум
            </div>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='text-[22px] font-extrabold text-[#b81b60] whitespace-nowrap'>
                {fmtMoney(data.forecastBooked)}
              </span>
              {bookedVsPrev !== null && <PctBadge pct={bookedVsPrev} title={vsPrevTitle} />}
            </div>
            <div className='text-[11.5px] font-semibold text-[#c76d97] mt-[3px]'>
              если новых записей не будет · % к итогу прошлого месяца
            </div>
          </div>
        </div>
      </div>

      {/* Вторичные показатели */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5'>
        <div className={`${cardCls} px-5 py-4`}>
          <div className={tileLabelCls}>Прогноз по темпу записей</div>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='text-[20px] font-extrabold text-[#161615] whitespace-nowrap'>
              {fmtMoney(data.forecastRunRate)}
            </span>
            {runRateVsPrev !== null && <PctBadge pct={runRateVsPrev} title={vsPrevTitle} />}
          </div>
          <div className={tileSubCls}>
            если визиты идут тем же темпом: факт ÷ {data.daysPassed} дн × {data.daysTotal} дн
          </div>
        </div>
        <div className={`${cardCls} px-5 py-4`}>
          <div className={tileLabelCls}>Прошлый месяц на эту же дату</div>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='text-[20px] font-extrabold text-[#161615] whitespace-nowrap'>
              {fmtMoney(data.prevMonthToSameDay)}
            </span>
            {tempo !== null && (
              <PctBadge
                pct={tempo}
                title={`наш факт ${fmtMoney(data.actualToDate)} против ${fmtMoney(data.prevMonthToSameDay)} к ${data.daysPassed}-му дню прошлого месяца`}
              />
            )}
          </div>
          <div className={tileSubCls}>
            к {data.daysPassed}-му дню · зелёный % = идём быстрее прошлого месяца
          </div>
        </div>
        <div className={`${cardCls} px-5 py-4`}>
          <div className={tileLabelCls}>Прошлый месяц (итог)</div>
          <div className='text-[20px] font-extrabold text-[#161615]'>
            {fmtMoney(data.prevMonthTotal)}
          </div>
          <div className={tileSubCls}>вся выручка по броням за месяц</div>
        </div>
        <div className={`${cardCls} px-5 py-4`}>
          <div className={tileLabelCls}>Затраты месяца</div>
          <div className='text-[20px] font-extrabold text-[#161615]'>
            {fmtMoney(data.expensesMonth)}
          </div>
          <div className={tileSubCls}>из коллекции «Затраты» (текущий месяц)</div>
        </div>
      </div>

      {/* Динамика за период */}
      <div className={cardPadCls}>
        <div className='flex items-center justify-between gap-3 flex-wrap mb-1'>
          <h2 className={cardTitleCls}>Динамика за период</h2>
          <div className='flex gap-1 flex-wrap'>
            {PERIOD_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setPeriodN(n)}
                disabled={history.length < n}
                title={history.length < n ? `данных только за ${history.length} мес` : undefined}
                className={`${pillCls(periodN === n)} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {n} мес
              </button>
            ))}
            <button onClick={() => setPeriodN('all')} className={pillCls(periodN === 'all')}>
              Всё время ({history.length} мес)
            </button>
          </div>
        </div>
        <div className='text-[12px] font-semibold text-[#a39e99] mb-4'>
          {periodLabel} · только полные месяцы (текущий не входит)
        </div>

        {period.length === 0 ? (
          <div className='py-12 text-center text-[13px] font-semibold text-[#a39e99]'>
            Нет данных за период
          </div>
        ) : (
          <>
            {/* Сводка прироста за период */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-[18px]'>
              <div className={tileCls}>
                <div className={tileLabelCls}>Выручка за период</div>
                <div className='flex items-center gap-[7px] flex-wrap'>
                  <span className='text-[19px] font-extrabold text-[#161615] whitespace-nowrap'>
                    {fmtMoney(periodRevenue)}
                  </span>
                  {hasPrevPeriod && (
                    <GrowthBadge
                      cur={periodRevenue}
                      base={prevRevenue}
                      title={`против предыдущих ${periodN} мес: ${fmtMoney(prevRevenue)}`}
                    />
                  )}
                </div>
                <div className={tileSubCls}>
                  {hasPrevPeriod
                    ? `пред. ${periodN} мес: ${fmtMoney(prevRevenue)}`
                    : 'сравнить не с чем — не хватает истории'}
                </div>
              </div>
              <div className={tileCls}>
                <div className={tileLabelCls}>Визитов за период</div>
                <div className='flex items-center gap-[7px] flex-wrap'>
                  <span className='text-[19px] font-extrabold text-[#161615]'>{periodVisits}</span>
                  {hasPrevPeriod && (
                    <GrowthBadge
                      cur={periodVisits}
                      base={prevVisits}
                      title={`против предыдущих ${periodN} мес: ${prevVisits} визитов`}
                    />
                  )}
                </div>
                <div className={tileSubCls}>
                  в среднем {Math.round(periodVisits / period.length)} в месяц
                </div>
              </div>
              <div className={tileCls}>
                <div className={tileLabelCls}>Прирост за период</div>
                <div
                  className={`text-[19px] font-extrabold ${
                    periodGrowth === null
                      ? 'text-[#161615]'
                      : periodGrowth >= 0
                        ? 'text-[#1d7a3f]'
                        : 'text-[#c53030]'
                  }`}
                >
                  {periodGrowth === null
                    ? '—'
                    : periodGrowth >= 200 && first && last
                      ? fmtFactor(last.revenue, first.revenue)
                      : `${periodGrowth >= 0 ? '+' : ''}${periodGrowth} %`}
                </div>
                <div className={tileSubCls}>
                  {periodGrowth !== null && periodGrowth >= 200
                    ? `месячная выручка: ${first?.label} → ${last?.label} (во столько раз больше)`
                    : `${first?.label} → ${last?.label} (по месячной выручке)`}
                </div>
              </div>
              <div className={tileCls}>
                <div className={tileLabelCls}>Средний месяц</div>
                <div className='text-[19px] font-extrabold text-[#161615]'>
                  {fmtMoney(avgMonthRevenue)}
                </div>
                <div className={tileSubCls}>выручка ÷ {period.length} мес</div>
              </div>
            </div>

            <div className='mb-2'>
              <RevenueBarChart data={period} />
            </div>
            <p className={`m-0 mb-6 ${hintCls}`}>
              Линия — выручка по броням; визиты видны при наведении и в таблице ниже.
            </p>

            <TableWrapper>
              <table className='w-full text-left min-w-[560px]'>
                <thead>
                  <tr>
                    <Cell title='Месяц' asHeader />
                    <Cell title='Визитов' asHeader />
                    <Cell title='Выручка по броням' asHeader />
                    <Cell title='К пред. месяцу' asHeader />
                    <Cell title='К началу периода' asHeader />
                  </tr>
                </thead>
                <tbody>
                  {period.map((h, i) => {
                    // MoM первой строки периода считается против месяца ДО периода (из общей истории)
                    const histIdx = history.length - period.length + i
                    const prevRow = histIdx > 0 ? history[histIdx - 1] : null
                    return (
                      <tr key={h.month} className='hover:bg-[#faf8f7] transition-colors'>
                        <Cell title={h.label} className='font-bold text-[#161615]' />
                        <Cell title={String(h.visits)} />
                        <td className='p-4 border-b border-[#f2efec]'>
                          <span className='text-[13.5px] font-bold text-[#b81b60] whitespace-nowrap'>
                            {fmtMoney(h.revenue)}
                          </span>
                        </td>
                        <td className='p-4 border-b border-[#f2efec]'>
                          {prevRow && prevRow.revenue > 0 ? (
                            <GrowthBadge
                              cur={h.revenue}
                              base={prevRow.revenue}
                              title={`${prevRow.label}: ${fmtMoney(prevRow.revenue)}`}
                            />
                          ) : (
                            <span className='text-[#c4bfba]'>—</span>
                          )}
                        </td>
                        <td className='p-4 border-b border-[#f2efec]'>
                          {i > 0 && first && first.revenue > 0 ? (
                            <GrowthBadge
                              cur={h.revenue}
                              base={first.revenue}
                              title={`против ${first.label}: ${fmtMoney(first.revenue)}`}
                            />
                          ) : (
                            <span className='text-[#c4bfba]'>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className='bg-[#faf9f8]'>
                    <Cell title='Итого' className='font-bold text-[#161615]' />
                    <Cell title={String(periodVisits)} className='font-bold' />
                    <td className='p-4 border-b border-[#f2efec]'>
                      <span className='text-[14px] font-extrabold text-[#b81b60] whitespace-nowrap'>
                        {fmtMoney(periodRevenue)}
                      </span>
                    </td>
                    <td className='p-4 border-b border-[#f2efec]' />
                    <td className='p-4 border-b border-[#f2efec]' />
                  </tr>
                </tbody>
              </table>
            </TableWrapper>
            <p className={`m-0 mt-3 ${hintCls}`}>
              «К пред. месяцу» — изменение против предыдущего месяца. «К началу периода» — против
              первого месяца периода ({first?.label}); ×N = во столько раз месяц больше.
              {periodN === 'all' &&
                ' База «Всё время» — месяц открытия салона с маленькой выручкой, поэтому множители такие большие.'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
