import { useEffect, useState } from 'react'

import { ClientsStackedBarChart } from '../components/ClientsStackedBarChart'
import { WeekdayLineChart } from '../components/WeekdayLineChart'
import { getClientStats, type ClientStats } from '../fetch/clientStats'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'

const SummaryCard = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={'bg-white rounded-xl shadow-md p-4 flex-1 min-w-[140px]'}>
    <div className={'text-xss text-gray-500 mb-1'}>{label}</div>
    <div className={`text-md font-bold ${accent ? 'text-primary' : 'text-gray-800'}`}>{value}</div>
  </div>
)

export default function ClientsTab() {
  const [data, setData] = useState<ClientStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getClientStats(force))
    } catch {
      setError('Не удалось загрузить данные. Попробуйте обновить.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return <div className={'py-12 text-center text-sm text-gray-400'}>Načítání…</div>
  }

  if (error || !data) {
    return (
      <div className={'py-12 text-center'}>
        <p className={'text-sm text-red-500 mb-4'}>{error ?? 'Нет данных'}</p>
        <button
          type={'button'}
          onClick={() => load(true)}
          className={'px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold'}
        >
          Обновить
        </button>
      </div>
    )
  }

  const { monthlyRows, currentRow, monthlyTotals, weekdayRows, weekdayWindowLabel } = data
  const chartData = [...monthlyRows, currentRow]
  const minNewPct = Math.min(...monthlyRows.map((r) => r.newPct))
  const maxVisitsPerDay = Math.max(...weekdayRows.map((r) => r.clientsPerDay))
  const minVisitsPerDay = Math.min(...weekdayRows.map((r) => r.clientsPerDay))

  return (
    <>
      <div className={'mb-6 flex justify-end'}>
        <button
          type={'button'}
          onClick={() => load(true)}
          className={'px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50'}
        >
          Обновить
        </button>
      </div>

      <StatSection title={'Новые и повторные клиенты по месяцам'} id={'clients-monthly'} defaultOpen>
        <p className={'text-xss text-gray-500 mb-4'}>
          По дате визита, уникальные клиенты, отменённые брони исключены. «Новый» — первый
          визит за всю историю пришёлся на этот месяц; «Повторный» — приходил и раньше (2-й и более
          раз).
        </p>

        <div className={'flex flex-wrap gap-3 mb-6'}>
          <SummaryCard
            label={'Всего клиентов (6 мес)'}
            value={String(monthlyTotals.total)}
          />
          <SummaryCard label={'Новые (6 мес)'} value={String(monthlyTotals.newClients)} accent />
          <SummaryCard label={'Повторные (6 мес)'} value={String(monthlyTotals.returning)} />
          <SummaryCard label={'Новых в среднем / мес'} value={String(monthlyTotals.avgNewPerMonth)} />
          <SummaryCard label={'Доля новых'} value={`${monthlyTotals.newPct}%`} />
        </div>

        <div className={'mb-6'}>
          <ClientsStackedBarChart data={chartData} />
        </div>

        <TableWrapper>
          <table className={'w-full text-left table-auto min-w-max'}>
            <thead>
              <tr>
                <Cell title={'Месяц'} asHeader />
                <Cell title={'Всего'} asHeader />
                <Cell title={'Новые'} asHeader />
                <Cell title={'Повторные'} asHeader />
                <Cell title={'% новых'} asHeader />
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((r) => (
                <tr
                  key={r.month}
                  className={
                    r.newPct > 50
                      ? 'bg-red-200 hover:bg-red-300 transition-colors'
                      : r.newPct === minNewPct
                        ? 'bg-green-200 hover:bg-green-300 transition-colors'
                        : 'hover:bg-gray-50 transition-colors'
                  }
                >
                  <Cell title={r.label} />
                  <Cell title={String(r.total)} />
                  <Cell title={String(r.newClients)} />
                  <Cell title={String(r.returning)} />
                  <Cell title={`${r.newPct}%`} />
                </tr>
              ))}
              <tr className={'hover:bg-gray-50 transition-colors'}>
                <Cell title={`${currentRow.label} (идёт)`} className={'text-gray-400 italic'} />
                <Cell title={String(currentRow.total)} className={'text-gray-400 italic'} />
                <Cell title={String(currentRow.newClients)} className={'text-gray-400 italic'} />
                <Cell title={String(currentRow.returning)} className={'text-gray-400 italic'} />
                <Cell title={`${currentRow.newPct}%`} className={'text-gray-400 italic'} />
              </tr>
              <tr className={'bg-gray-50 font-bold'}>
                <Cell title={'Итого (6 мес)'} className={'font-bold'} />
                <Cell title={String(monthlyTotals.total)} className={'font-bold'} />
                <Cell title={String(monthlyTotals.newClients)} className={'font-bold'} />
                <Cell title={String(monthlyTotals.returning)} className={'font-bold'} />
                <Cell title={`${monthlyTotals.newPct}%`} className={'font-bold'} />
              </tr>
            </tbody>
          </table>
        </TableWrapper>
      </StatSection>

      <StatSection title={'Загрузка по дням недели'} id={'clients-weekday'} defaultOpen>
        <p className={'text-xss text-gray-500 mb-4'}>
          За период {weekdayWindowLabel}. «Визиты» — клиент засчитывается один раз в день; «раб. дней»
          — сколько таких дней недели было в периоде.
        </p>

        <div className={'mb-6'}>
          <WeekdayLineChart data={weekdayRows} />
        </div>

        <TableWrapper>
          <table className={'w-full text-left table-auto min-w-max'}>
            <thead>
              <tr>
                <Cell title={'День недели'} asHeader />
                <Cell title={'Резерваций'} asHeader />
                <Cell title={'Визитов клиентов'} asHeader />
                <Cell title={'Раб. дней'} asHeader />
                <Cell title={'Резерв./день'} asHeader />
                <Cell title={'Визитов/день'} asHeader />
              </tr>
            </thead>
            <tbody>
              {weekdayRows.map((r) => (
                <tr
                  key={r.dow}
                  className={
                    r.clientsPerDay === maxVisitsPerDay
                      ? 'bg-green-200 hover:bg-green-300 transition-colors'
                      : r.clientsPerDay === minVisitsPerDay
                        ? 'bg-red-200 hover:bg-red-300 transition-colors'
                        : 'hover:bg-gray-50 transition-colors'
                  }
                >
                  <Cell title={r.label} />
                  <Cell title={String(r.reservations)} />
                  <Cell title={String(r.clients)} />
                  <Cell title={String(r.workingDays)} />
                  <Cell title={String(r.reservationsPerDay)} />
                  <Cell title={String(r.clientsPerDay)} />
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </StatSection>
    </>
  )
}
