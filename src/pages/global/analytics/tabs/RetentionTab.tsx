import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { hintCls } from '../../../../ui/kit'
import { getRetention, type RetentionResult, type RetentionRow } from '../fetch/retention'

const pctBadge = (pct: number | null): string => {
  if (pct === null) return 'text-ink-faint bg-surface-input'
  if (pct >= 50) return 'text-pos bg-pos-bg'
  if (pct >= 30) return 'text-warn bg-warn-bg'
  return 'text-neg bg-neg-bg'
}

const PctChip = ({ w }: { w: { eligible: number; returned: number; pct: number | null } }) => (
  <span
    className={`inline-block text-[11px] font-bold rounded-md px-[7px] py-0.5 whitespace-nowrap ${pctBadge(w.pct)}`}
    title={`вернулись ${w.returned} из ${w.eligible}`}
  >
    {w.pct === null ? '—' : `${w.pct} % · ${w.returned}`}
  </span>
)

export default function RetentionTab() {
  const [data, setData] = useState<RetentionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getRetention(force))
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <StatSection title="Возвращаемость новых клиентов по мастерам" id="retention" defaultOpen>
        <div className={`w-full text-left mb-4 space-y-1 ${hintCls}`}>
          <p>
            <b>Как читать:</b> «Новых клиентов» — сколько человек пришли в салон{' '}
            <b>впервые в жизни</b> именно к этому мастеру. Дальше — какой % из них записался на
            следующий визит (к любому мастеру) в течение 30 / 60 / 90 дней после первого. В чипе:
            процент · число вернувшихся.
          </p>
          <p>
            <b>Пример:</b> у Veronika 84 новых клиента, «≤90 дн. — 45 % · 38» значит: 38 из 84
            записались снова в течение трёх месяцев. «К тому же мастеру» — вернулись именно к ней,
            а не к коллеге. Чем выше %, тем лучше мастер удерживает новичков.
          </p>
          <p className="text-ink-faint">
            Учитываются только клиенты, у которых окно уже закрыто (первый визит был достаточно
            давно) — поэтому числа в колонках могут чуть отличаться. Показаны только активные
            мастера; «Весь салон» — по всей истории, включая бывших.
          </p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Načítání…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] font-semibold text-brand-alert">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Недостаточно данных.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <Cell title="Мастер" asHeader />
                  <Cell title="Новых клиентов" asHeader />
                  <Cell title="Вернулись ≤30 дн." asHeader />
                  <Cell title="≤60 дн." asHeader />
                  <Cell title="≤90 дн." asHeader />
                  <Cell title="К тому же мастеру ≤90 дн." asHeader />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: RetentionRow) => (
                  <tr key={r.employeeId} className="hover:bg-surface-hover transition-colors">
                    <Cell title={r.name} className="font-bold text-ink" />
                    <Cell title={String(r.newClients)} />
                    <td className="px-3 py-[10px] border-b border-line-soft">
                      <PctChip w={r.r30} />
                    </td>
                    <td className="px-3 py-[10px] border-b border-line-soft">
                      <PctChip w={r.r60} />
                    </td>
                    <td className="px-3 py-[10px] border-b border-line-soft">
                      <PctChip w={r.r90} />
                    </td>
                    <td className="px-3 py-[10px] border-b border-line-soft">
                      <PctChip w={r.same90} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-tile">
                  <Cell title={data.total.name} className="font-extrabold text-ink" />
                  <Cell
                    title={String(data.total.newClients)}
                    className="font-extrabold text-ink"
                  />
                  <td className="px-3 py-[10px] border-b border-line-soft">
                    <PctChip w={data.total.r30} />
                  </td>
                  <td className="px-3 py-[10px] border-b border-line-soft">
                    <PctChip w={data.total.r60} />
                  </td>
                  <td className="px-3 py-[10px] border-b border-line-soft">
                    <PctChip w={data.total.r90} />
                  </td>
                  <td className="px-3 py-[10px] border-b border-line-soft">
                    <PctChip w={data.total.same90} />
                  </td>
                </tr>
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>
    </>
  )
}
