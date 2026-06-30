import { useState, useEffect, useCallback, useMemo } from 'react'

import { Cell } from '../../../dashboard/components/Cell'
import { BlocksContent } from '../../../dashboard/components/BlocksContent'
import { Select } from '../../../dashboard/components/Select'
import { monthLabels } from '../../../dashboard/data'
import { getGlobalMonthData } from '../../../dashboard/fetch/monthDataCache'
import { toLocalStringDigits } from '../../../../utils/toLocalString'
import { GlobalLineChart } from '../../charts/components/GlobalLineChart'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { blockStateItems, computeMonthResult } from '../../data'
import {
  getGlobalStatsRange,
  lastNMonths,
  monthsInRange,
  type GlobalStatsResult,
  type MonthKey,
} from '../fetch/globalStats'

const PRESETS = [
  { label: '3 месяца', n: 3 },
  { label: '6 месяцев', n: 6 },
  { label: '12 месяцев', n: 12 },
]

const rangeLabel = (months: MonthKey[]): string => {
  if (months.length === 0) return ''
  const a = months[0]
  const b = months[months.length - 1]
  return `${monthLabels[a.month]} ${a.year} — ${monthLabels[b.month]} ${b.year}`
}

const formatAgo = (ts: number): string => {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'обновлено только что'
  const min = Math.floor(sec / 60)
  if (min < 60) return `обновлено ${min} мин назад`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `обновлено ${hour} ч назад`
  return `обновлено ${Math.floor(hour / 24)} дн назад`
}

export default function GlobalStatsTab() {
  const now = new Date()
  // По умолчанию — последние 6 месяцев.
  const initial = lastNMonths(6)
  const [from, setFrom] = useState<MonthKey>(initial[0])
  const [to, setTo] = useState<MonthKey>(initial[initial.length - 1])

  const months = useMemo(() => monthsInRange(from, to), [from, to])

  const [result, setResult] = useState<GlobalStatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingMonth, setRefreshingMonth] = useState<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      setLoading(true)
      setError(null)
      try {
        setResult(await getGlobalStatsRange(months, force))
      } catch {
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    },
    [months],
  )

  useEffect(() => {
    load(false)
  }, [load])

  const setPreset = (n: number) => {
    const list = lastNMonths(n)
    setFrom(list[0])
    setTo(list[list.length - 1])
  }

  // Принудительно пересчитать ОДИН месяц и пере-собрать итоги.
  const refreshMonth = async (mk: MonthKey) => {
    const key = `${mk.year}_${mk.month}`
    setRefreshingMonth(key)
    try {
      await getGlobalMonthData(mk.month, mk.year, true)
      await load(false) // forced месяц теперь свежий в кэше → итоги пересоберутся
    } finally {
      setRefreshingMonth(null)
    }
  }

  const activePreset = useMemo(() => {
    for (const p of PRESETS) {
      const list = lastNMonths(p.n)
      if (
        list[0].month === from.month &&
        list[0].year === from.year &&
        list[list.length - 1].month === to.month &&
        list[list.length - 1].year === to.year
      ) {
        return p.n
      }
    }
    return null
  }, [from, to])

  const totals = result?.totals

  // Точки графика по месяцам (финансовый тренд). XAxis в GlobalLineChart = ключ `date`.
  const chartData = useMemo(
    () =>
      (result?.rows ?? []).map((r) => {
        const d = r.data
        return {
          date: `${monthLabels[r.month]} ${String(r.year).slice(2)}`,
          оборот: Math.round(d.globalFlow),
          результат: Math.round(
            computeMonthResult({
              cashMoney: d.cashMoney,
              cardExtraIncome: d.cardExtraIncome,
              cardMoney: d.cardMoney,
              qrMoney: d.qrMoney,
              sumMasters: d.sumMasters,
              sumAdmins: d.sumAdmins,
              sumCombined: d.sumCombined,
              noDphCosts: d.noDphCosts,
              taxesSum: d.taxesSum,
            }),
          ),
          зарплаты: Math.round(d.sumMasters + d.sumAdmins + d.sumCombined),
          затраты: Math.round(d.noDphCosts),
        }
      }),
    [result],
  )

  return (
    <>
      {/* Выбор периода */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.n}
              type="button"
              onClick={() => setPreset(p.n)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activePreset === p.n
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">С</span>
            <Select
              month={from.month}
              setMonth={(m) => setFrom((f) => ({ ...f, month: m }))}
              year={from.year}
              setYear={(y) => setFrom((f) => ({ ...f, year: y }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">По</span>
            <Select
              month={to.month}
              setMonth={(m) => setTo((t) => ({ ...t, month: m }))}
              year={to.year}
              setYear={(y) => setTo((t) => ({ ...t, year: y }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-600">
            {rangeLabel(months)} · {months.length} мес.
          </span>
          <div className="flex items-center gap-2">
            {result && result.cachedAt > 0 && (
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatAgo(result.cachedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Обновление…' : 'Обновить всё'}
            </button>
          </div>
        </div>
      </div>

      {loading && !result && (
        <div className="text-gray-500 py-8 text-center">Načítání…</div>
      )}
      {error && <div className="text-red-600 py-8 text-center">{error}</div>}

      {totals && (
        <>
          <StatSection title="Финансовый обзор за период" id="global-stats-overview" defaultOpen>
            <BlocksContent
              items={blockStateItems(
                totals.noDphCosts,
                totals.globalFlow,
                totals.cashMoney,
                totals.cardMoney,
                totals.cardExtraIncome,
                totals.sumMasters,
                totals.sumAdmins,
                totals.payrollSum,
                totals.voucherRealized,
                totals.voucherPayed,
                totals.qrMoney,
                totals.extraMoney,
                totals.costs,
                totals.salonSalariesCash,
                totals.salonSalariesCard,
                totals.taxesSum,
                totals.sumCombined,
                totals.combinedAdminEarnings,
              )}
            />
          </StatSection>

          <StatSection title="Резервации за период" id="global-stats-reservations" defaultOpen>
            <BlocksContent
              items={[
                { title: 'Резервации все', value: totals.clientsAll },
                {
                  title: 'Реалз. / Все Платные',
                  value: `${totals.clientsPastPayed} / ${totals.clientsPayed}`,
                },
                {
                  title: 'Осталось платных',
                  value: `${totals.clientsPayed - totals.clientsPastPayed}`,
                },
                { title: 'Все проведенные', value: totals.sumClientsDone },
                { title: 'Не пришли', value: totals.clientsNoshow },
                { title: 'Отменили', value: totals.clientsCanceled },
                { title: 'Оправа', value: totals.clientsFixed },
                { title: 'Зарезерв. за период', value: totals.countCreatedMonthReservation },
                { title: 'Индекс резерваций (в день)', value: totals.reservationIndex },
              ]}
            />
          </StatSection>

          {result && (
            <StatSection title="Помесячная разбивка" id="global-stats-breakdown">
              <div className="mb-6">
                <GlobalLineChart
                  data={chartData}
                  lines={[
                    { dataKey: 'оборот', stroke: '#e71e6e', name: 'Оборот' },
                    { dataKey: 'результат', stroke: '#16a34a', name: 'Результат' },
                    { dataKey: 'зарплаты', stroke: '#161615', name: 'Зарплаты' },
                    { dataKey: 'затраты', stroke: '#f59e0b', name: 'Затраты' },
                  ]}
                />
              </div>
              <TableWrapper>
                <table className="w-full text-left table-auto min-w-max">
                  <thead>
                    <tr>
                      <Cell title="Месяц" asHeader />
                      <Cell title="Оборот" asHeader />
                      <Cell title="Результат" asHeader />
                      <Cell title="Зарплаты" asHeader />
                      <Cell title="Затраты" asHeader />
                      <Cell title="Резерваций" asHeader />
                      <Cell title="" asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => {
                      const d = r.data
                      const monthResult = computeMonthResult({
                        cashMoney: d.cashMoney,
                        cardExtraIncome: d.cardExtraIncome,
                        cardMoney: d.cardMoney,
                        qrMoney: d.qrMoney,
                        sumMasters: d.sumMasters,
                        sumAdmins: d.sumAdmins,
                        sumCombined: d.sumCombined,
                        noDphCosts: d.noDphCosts,
                        taxesSum: d.taxesSum,
                      })
                      const salaries = d.sumMasters + d.sumAdmins + d.sumCombined
                      const key = `${r.year}_${r.month}`
                      const isCurrent =
                        r.year === now.getFullYear() && r.month === now.getMonth()
                      return (
                        <tr key={key} className="hover:bg-gray-50 transition-colors">
                          <Cell
                            title={`${monthLabels[r.month]} ${r.year}${isCurrent ? ' (идёт)' : ''}`}
                            className="font-medium"
                          />
                          <Cell title={`${d.globalFlow.toLocaleString()} Kč`} />
                          <td className="p-4 border-b border-blue-gray-50">
                            <span
                              className={`font-sans text-sm font-medium ${
                                monthResult >= 0 ? 'text-green-700' : 'text-red-600'
                              }`}
                            >
                              {toLocalStringDigits(monthResult)}
                            </span>
                          </td>
                          <Cell title={salaries.toLocaleString()} />
                          <Cell title={d.noDphCosts.toLocaleString()} />
                          <Cell title={String(d.clients.all)} />
                          <td className="p-4 border-b border-blue-gray-50">
                            <button
                              type="button"
                              onClick={() => refreshMonth({ month: r.month, year: r.year })}
                              disabled={refreshingMonth === key}
                              className="px-2 py-1 rounded text-xs font-semibold border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {refreshingMonth === key ? '…' : 'Обновить'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableWrapper>
              <p className="text-xs text-gray-400 mt-3">
                Прошлые месяцы держатся в кэше постоянно (они уже не меняются). Кнопка
                «Обновить» пересчитывает конкретный месяц заново.
              </p>
            </StatSection>
          )}
        </>
      )}
    </>
  )
}
