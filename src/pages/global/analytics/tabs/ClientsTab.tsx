import { useEffect, useState } from 'react'

import { ClientsStackedBarChart } from '../components/ClientsStackedBarChart'
import { WeekdayLineChart } from '../components/WeekdayLineChart'
import { getClientStats, type ClientStats } from '../fetch/clientStats'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'

const SummaryCard = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={'bg-white rounded-xl shadow-md p-4 flex-1 min-w-[140px]'}>
    <div className={'text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-soft mb-[5px]'}>{label}</div>
    <div className={`text-[21px] font-extrabold leading-[1.15] ${accent ? 'text-brand-dark' : 'text-ink'}`}>{value}</div>
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
    return <div className={'py-12 text-center text-sm text-ink-faint'}>Načítání…</div>
  }

  if (error || !data) {
    return (
      <div className={'py-12 text-center'}>
        <p className={'text-sm text-neg mb-4'}>{error ?? 'Нет данных'}</p>
        <button
          type={'button'}
          onClick={() => load(true)}
          className={'px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold'}
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
          className={'px-4 py-2 rounded-lg border border-line-btn bg-white text-sm font-semibold text-ink-body hover:bg-surface-hover'}
        >
          Обновить
        </button>
      </div>

      <StatSection title={'Новые и повторные клиенты по месяцам'} id={'clients-monthly'} defaultOpen>
        <p className={'text-[12.5px] leading-[1.55] font-medium text-ink-hint mb-3.5'}>
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
          <table className={'w-full text-left min-w-[620px]'}>
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
                        : 'hover:bg-surface-hover transition-colors'
                  }
                >
                  <Cell title={r.label} />
                  <Cell title={String(r.total)} />
                  <Cell title={String(r.newClients)} />
                  <Cell title={String(r.returning)} />
                  <Cell title={`${r.newPct}%`} />
                </tr>
              ))}
              <tr className={'hover:bg-surface-hover transition-colors'}>
                <Cell title={`${currentRow.label} (идёт)`} className={'text-ink-faint italic'} />
                <Cell title={String(currentRow.total)} className={'text-ink-faint italic'} />
                <Cell title={String(currentRow.newClients)} className={'text-ink-faint italic'} />
                <Cell title={String(currentRow.returning)} className={'text-ink-faint italic'} />
                <Cell title={`${currentRow.newPct}%`} className={'text-ink-faint italic'} />
              </tr>
              <tr className={'bg-surface-tile font-bold'}>
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
        <p className={'text-[12.5px] leading-[1.55] font-medium text-ink-hint mb-3.5'}>
          За период {weekdayWindowLabel}. «Визиты» — клиент засчитывается один раз в день; «раб. дней»
          — сколько таких дней недели было в периоде.
        </p>

        <div className={'mb-6'}>
          <WeekdayLineChart data={weekdayRows} />
        </div>

        <TableWrapper>
          <table className={'w-full text-left min-w-[620px]'}>
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
                        : 'hover:bg-surface-hover transition-colors'
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
