import { useState, useEffect, useCallback } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getRetention, type RetentionResult, type RetentionRow } from '../fetch/retention'

const pctBadge = (pct: number | null): string => {
  if (pct === null) return 'bg-gray-100 text-gray-400'
  if (pct >= 50) return 'bg-green-100 text-green-700'
  if (pct >= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const PctChip = ({ w }: { w: { eligible: number; returned: number; pct: number | null } }) => (
  <span
    className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${pctBadge(w.pct)}`}
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
        <div className="w-full text-left text-xs text-gray-500 mb-4 space-y-1">
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
          <p className="text-gray-400">
            Учитываются только клиенты, у которых окно уже закрыто (первый визит был достаточно
            давно) — поэтому числа в колонках могут чуть отличаться. Показаны только активные
            мастера; «Весь салон» — по всей истории, включая бывших.
          </p>
        </div>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-red-600 py-8 text-center">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">Недостаточно данных.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
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
                  <tr key={r.employeeId} className="hover:bg-gray-50 transition-colors">
                    <Cell title={r.name} className="font-medium" />
                    <Cell title={String(r.newClients)} />
                    <td className="p-4 border-b border-blue-gray-50">
                      <PctChip w={r.r30} />
                    </td>
                    <td className="p-4 border-b border-blue-gray-50">
                      <PctChip w={r.r60} />
                    </td>
                    <td className="p-4 border-b border-blue-gray-50">
                      <PctChip w={r.r90} />
                    </td>
                    <td className="p-4 border-b border-blue-gray-50">
                      <PctChip w={r.same90} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <Cell title={data.total.name} className="font-bold" />
                  <Cell title={String(data.total.newClients)} className="font-bold" />
                  <td className="p-4 border-b border-blue-gray-50">
                    <PctChip w={data.total.r30} />
                  </td>
                  <td className="p-4 border-b border-blue-gray-50">
                    <PctChip w={data.total.r60} />
                  </td>
                  <td className="p-4 border-b border-blue-gray-50">
                    <PctChip w={data.total.r90} />
                  </td>
                  <td className="p-4 border-b border-blue-gray-50">
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
