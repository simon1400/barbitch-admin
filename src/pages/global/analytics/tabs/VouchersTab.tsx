import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getVouchersReport, type VouchersReport } from '../fetch/vouchersReport'

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
const ageDays = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return Math.floor((Date.now() - new Date(y, m - 1, day).getTime()) / 86400000)
}

export default function VouchersTab() {
  const [data, setData] = useState<VouchersReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getVouchersReport())
    } catch {
      setError('Не удалось загрузить ваучеры из Strapi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="text-ink-soft py-8 text-center">Načítání…</div>
  if (error || !data) return <div className="text-neg py-8 text-center">{error}</div>

  return (
    <>
      <div className="flex gap-4 flex-wrap mb-6">
        <div className="bg-white rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-ink-faint">Продано (оплачено) всего</div>
          <div className="text-2xl font-bold text-ink">{data.paidTotalCount}</div>
          <div className="text-xs text-ink-faint mt-1">{fmtMoney(data.paidTotalSum)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-ink-faint">Реализовано</div>
          <div className="text-2xl font-bold text-pos">{data.realizedTotalCount}</div>
          <div className="text-xs text-ink-faint mt-1">{fmtMoney(data.realizedTotalSum)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-ink-faint">Висит (оплачен, не использован)</div>
          <div className="text-2xl font-bold text-brand">{data.outstandingCount}</div>
          <div className="text-xs text-ink-faint mt-1">
            обязательство {fmtMoney(data.outstandingSum)}
          </div>
        </div>
      </div>

      <StatSection title="По месяцам (последние 12)" id="vouchers-monthly" defaultOpen>
        <TableWrapper>
          <table className="w-full text-left min-w-[620px]">
            <thead>
              <tr>
                <Cell title="Месяц" asHeader />
                <Cell title="Заказано" asHeader />
                <Cell title="Оплачено" asHeader />
                <Cell title="Сумма продаж" asHeader />
                <Cell title="Реализовано" asHeader />
                <Cell title="Сумма реализаций" asHeader />
              </tr>
            </thead>
            <tbody>
              {data.byMonth.map((m) => (
                <tr key={m.month} className="hover:bg-surface-hover transition-colors">
                  <Cell title={m.label} className="font-medium" />
                  <Cell title={m.orderedCount ? String(m.orderedCount) : '—'} />
                  <Cell title={m.paidCount ? String(m.paidCount) : '—'} />
                  <Cell
                    title={m.paidSum ? fmtMoney(m.paidSum) : '—'}
                    className={m.paidSum ? 'text-brand' : ''}
                  />
                  <Cell title={m.realizedCount ? String(m.realizedCount) : '—'} />
                  <Cell title={m.realizedSum ? fmtMoney(m.realizedSum) : '—'} />
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </StatSection>

      <StatSection
        title={`Неиспользованные ваучеры (${data.outstandingCount})`}
        id="vouchers-outstanding"
      >
        {data.outstanding.length === 0 ? (
          <div className="text-ink-soft py-8 text-center">Все оплаченные ваучеры использованы.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left min-w-[620px]">
              <thead>
                <tr>
                  <Cell title="Ваучер" asHeader />
                  <Cell title="Покупатель" asHeader />
                  <Cell title="Для" asHeader />
                  <Cell title="Сумма" asHeader />
                  <Cell title="Оплачен" asHeader />
                  <Cell title="Возраст" asHeader />
                </tr>
              </thead>
              <tbody>
                {data.outstanding.map((v) => {
                  const age = v.datePay ? ageDays(v.datePay) : 0
                  return (
                    <tr key={v.documentId || v.id} className="hover:bg-surface-hover transition-colors">
                      <Cell title={v.idVoucher} className="font-mono text-xs" />
                      <Cell title={v.name} className="font-medium" />
                      <Cell title={v.forWhom || '—'} />
                      <Cell title={fmtMoney(v.sum)} className="text-brand" />
                      <Cell title={fmtDate(v.datePay)} />
                      <Cell
                        title={`${age} дн.`}
                        className={age > 300 ? 'text-neg font-semibold' : ''}
                      />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>
    </>
  )
}
