import { useEffect, useMemo, useRef, useState } from 'react'
import { monthLabelRu, todayYmd } from '../../../utils/date'
import { kc } from '../../../utils/money'
import { colHeadCls, hintCls, mutedCls } from '../../../ui/kit'
import { StatSection } from '../components/StatSection'
import { compareByCategory, fetchCostsMonth, prevMonthOf, type CostRow } from '../fetch/expenses'

const pct = (cur: number, base: number): string => (base > 0 ? ` (${cur >= base ? '+' : '−'}${Math.round((Math.abs(cur - base) / base) * 100)} %)` : '')

/** Разница: больше затрат — красным, меньше — зелёным. */
function Delta({ cur, base }: { cur: number; base: number }) {
  const d = cur - base
  if (d === 0) return <span className={mutedCls}>0</span>
  return (
    <span className={`whitespace-nowrap font-bold ${d > 0 ? 'text-neg' : 'text-pos'}`}>
      {d > 0 ? '+' : '−'}
      {kc(Math.abs(d))}
      <span className="font-semibold">{pct(cur, base)}</span>
    </span>
  )
}

interface Props {
  /** загруженный месяц ГГГГ-ММ; '' — ещё не загружен */
  ym: string
  token: number
  rows: CostRow[]
  onSelect: (category: string) => void
}

// Сравнение с прошлым месяцем по категориям (s238, Фаза 3). Суммы с DPH. Если открыт
// текущий месяц, разница считается с прошлым «по то же число» — неполный месяц иначе
// всегда выглядел бы дешевле; весь прошлый месяц — отдельной колонкой. Клик по
// категории — фильтр таблицы (как клик по столбцу графика).
// Прошлый месяц грузится, только когда секцию раскрыли (тело монтируется при открытии).
export function MonthCompare(props: Props) {
  if (!props.ym) return null
  return (
    <StatSection title={'Сравнение с прошлым месяцем'} id={'month-compare'} defaultOpen={false}>
      <CompareBody {...props} />
    </StatSection>
  )
}

function CompareBody({ ym, token, rows, onSelect }: Props) {
  const [prev, setPrev] = useState<{ ym: string; rows: CostRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!ym) return
    const my = ++seq.current
    const [y, m] = ym.split('-').map(Number)
    const p = prevMonthOf(m - 1, y)
    const pym = `${p.year}-${String(p.month + 1).padStart(2, '0')}`
    fetchCostsMonth(p.month, p.year)
      .then((res) => {
        if (my !== seq.current) return
        setPrev({ ym: pym, rows: res.rows })
        setError(null)
      })
      .catch((e: Error) => {
        if (my !== seq.current) return
        setPrev(null)
        setError(e.message)
      })
  }, [ym, token])

  const today = todayYmd()
  const toDay = today.startsWith(ym) ? Number(today.slice(8, 10)) : null
  const lines = useMemo(() => (prev ? compareByCategory(rows, prev.rows, toDay) : []), [rows, prev, toDay])

  const total = lines.reduce(
    (t, l) => ({ sum: t.sum + l.sum, prevSum: t.prevSum + l.prevSum, prevToDay: t.prevToDay + (l.prevToDay ?? 0) }),
    { sum: 0, prevSum: 0, prevToDay: 0 },
  )
  const curLabel = monthLabelRu(ym)
  const prevLabel = prev ? monthLabelRu(prev.ym) : ''
  const cell = 'px-2 py-2 border-b border-line-soft text-right whitespace-nowrap text-[13.5px]'

  return (
    <>
      {error && (
        <div role="alert" className="mb-3 text-[12.5px] font-semibold text-neg">
          Не удалось загрузить прошлый месяц: {error}
        </div>
      )}
      {!prev ? (
        !error && <div className={mutedCls}>Загрузка…</div>
      ) : lines.length === 0 ? (
        <div className={hintCls}>Затрат нет ни в этом, ни в прошлом месяце.</div>
      ) : (
        <>
          {toDay !== null && (
            <p className={`${hintCls} mt-0 mb-2`}>
              Месяц ещё идёт — разница считается с {prevLabel} по {toDay}-е число.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse" data-testid="month-compare">
              <thead>
                <tr>
                  <th className={`${colHeadCls} text-left px-2 pb-2`}>Категория</th>
                  <th className={`${colHeadCls} text-right px-2 pb-2`}>{curLabel}</th>
                  {toDay !== null && (
                    <th className={`${colHeadCls} text-right px-2 pb-2`}>
                      {prevLabel} по {toDay}-е
                    </th>
                  )}
                  <th className={`${colHeadCls} text-right px-2 pb-2`}>{toDay !== null ? `${prevLabel} весь` : prevLabel}</th>
                  <th className={`${colHeadCls} text-right px-2 pb-2`}>Разница</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const base = l.prevToDay ?? l.prevSum
                  return (
                    <tr
                      key={l.category}
                      data-category={l.category}
                      className="cursor-pointer transition-colors hover:bg-surface-hover"
                      onClick={() => onSelect(l.category)}
                    >
                      <td className="px-2 py-2 border-b border-line-soft text-[13.5px] font-bold text-ink">{l.category}</td>
                      <td className={`${cell} font-extrabold text-ink`}>{kc(l.sum)}</td>
                      {toDay !== null && <td className={`${cell} text-ink-soft`}>{kc(l.prevToDay ?? 0)}</td>}
                      <td className={`${cell} text-ink-soft`}>{kc(l.prevSum)}</td>
                      <td className={cell}>
                        <Delta cur={l.sum} base={base} />
                      </td>
                    </tr>
                  )
                })}
                <tr data-total>
                  <td className="px-2 pt-3 text-[13.5px] font-extrabold text-ink">Всего</td>
                  <td className={`${cell} border-0 pt-3 font-extrabold text-brand-dark`}>{kc(total.sum)}</td>
                  {toDay !== null && <td className={`${cell} border-0 pt-3 text-ink-soft`}>{kc(total.prevToDay)}</td>}
                  <td className={`${cell} border-0 pt-3 text-ink-soft`}>{kc(total.prevSum)}</td>
                  <td className={`${cell} border-0 pt-3`}>
                    <Delta cur={total.sum} base={toDay !== null ? total.prevToDay : total.prevSum} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
