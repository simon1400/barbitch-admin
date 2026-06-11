import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getCancellations, type CancellationsData } from '../fetch/cancellations'

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`
const fmtH = (min: number) => `${Math.round((min / 60) * 10) / 10} ч`
const fmtDate = (d: string) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function CancellationsTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [data, setData] = useState<CancellationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getCancellations(month, year))
    } catch {
      setError('Не удалось загрузить данные из Noona')
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="text-gray-500 py-8 text-center">Načítání…</div>

  return (
    <>
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap sticky top-0 z-40">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <span className="text-xs text-gray-400">
          No-show = фактическая потеря · отмена = верхняя оценка (слот могли перебронировать)
        </span>
      </div>

      {error || !data ? (
        <div className="text-red-600 py-8 text-center">{error}</div>
      ) : (
        <>
          <div className="flex gap-4 flex-wrap mb-6">
            <div className="bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="text-xs text-gray-400">No-show</div>
              <div className="text-2xl font-bold text-red-600">{data.noshow.count}</div>
              <div className="text-xs text-gray-400 mt-1">
                {fmtH(data.noshow.lostMin)} · {fmtMoney(data.noshow.lostMoney)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="text-xs text-gray-400">Отмены</div>
              <div className="text-2xl font-bold text-amber-600">{data.cancelled.count}</div>
              <div className="text-xs text-gray-400 mt-1">
                {fmtH(data.cancelled.lostMin)} · {fmtMoney(data.cancelled.lostMoney)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="text-xs text-gray-400">Состоявшихся визитов</div>
              <div className="text-2xl font-bold text-blue-gray-900">{data.totalVisits}</div>
              <div className="text-xs text-gray-400 mt-1">
                доля no-show:{' '}
                {data.totalVisits + data.noshow.count
                  ? Math.round(
                      (data.noshow.count / (data.totalVisits + data.noshow.count)) * 100,
                    )
                  : 0}{' '}
                %
              </div>
            </div>
          </div>

          <StatSection title="По мастерам" id="cancel-masters" defaultOpen>
            {data.byMaster.length === 0 ? (
              <div className="text-gray-500 py-8 text-center">За месяц отмен нет.</div>
            ) : (
              <TableWrapper>
                <table className="w-full text-left table-auto min-w-max">
                  <thead>
                    <tr>
                      <Cell title="Мастер" asHeader />
                      <Cell title="No-show" asHeader />
                      <Cell title="Потеря (no-show)" asHeader />
                      <Cell title="Отмены" asHeader />
                      <Cell title="Объём отмен" asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMaster.map((m) => (
                      <tr key={m.name} className="hover:bg-gray-50 transition-colors">
                        <Cell title={m.name} className="font-medium" />
                        <Cell
                          title={m.noshow.count ? String(m.noshow.count) : '—'}
                          className={m.noshow.count ? 'text-red-600 font-semibold' : ''}
                        />
                        <Cell
                          title={m.noshow.count ? `${fmtH(m.noshow.lostMin)} · ${fmtMoney(m.noshow.lostMoney)}` : '—'}
                        />
                        <Cell title={m.cancelled.count ? String(m.cancelled.count) : '—'} />
                        <Cell
                          title={m.cancelled.count ? `${fmtH(m.cancelled.lostMin)} · ${fmtMoney(m.cancelled.lostMoney)}` : '—'}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </StatSection>

          <StatSection title="Клиенты с отменами (топ-15)" id="cancel-clients">
            {data.topClients.length === 0 ? (
              <div className="text-gray-500 py-8 text-center">Нет данных.</div>
            ) : (
              <TableWrapper>
                <table className="w-full text-left table-auto min-w-max">
                  <thead>
                    <tr>
                      <Cell title="Клиент" asHeader />
                      <Cell title="No-show" asHeader />
                      <Cell title="Отмены" asHeader />
                      <Cell title="Сумма броней" asHeader />
                      <Cell title="Последняя" asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.map((c) => (
                      <tr key={c.customerId} className="hover:bg-gray-50 transition-colors">
                        <Cell title={c.name} className="font-medium" />
                        <Cell
                          title={c.noshowCount ? String(c.noshowCount) : '—'}
                          className={c.noshowCount ? 'text-red-600 font-semibold' : ''}
                        />
                        <Cell title={c.cancelledCount ? String(c.cancelledCount) : '—'} />
                        <Cell title={fmtMoney(c.lostMoney)} />
                        <Cell title={fmtDate(c.lastDate)} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </StatSection>

          <StatSection title="По дням недели" id="cancel-weekdays">
            <TableWrapper>
              <table className="w-full text-left table-auto min-w-max">
                <thead>
                  <tr>
                    <Cell title="День" asHeader />
                    <Cell title="No-show" asHeader />
                    <Cell title="Отмены" asHeader />
                  </tr>
                </thead>
                <tbody>
                  {data.byWeekday.map((d) => (
                    <tr key={d.label} className="hover:bg-gray-50 transition-colors">
                      <Cell title={d.label} className="font-medium" />
                      <Cell title={d.noshow ? String(d.noshow) : '—'} />
                      <Cell title={d.cancelled ? String(d.cancelled) : '—'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        </>
      )}
    </>
  )
}
