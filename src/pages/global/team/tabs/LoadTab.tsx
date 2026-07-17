import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  getMasterLoad,
  getMasterLoadRange,
  dateToStr,
  fmtHours,
  type MasterLoadResult,
  type MasterLoadRow,
} from '../fetch/masterLoad'

const pctBadge = (pct: number | null): string => {
  if (pct === null) return 'bg-gray-100 text-gray-400'
  if (pct >= 75) return 'bg-green-100 text-green-700'
  if (pct >= 45) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const PctChip = ({ pct }: { pct: number | null }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${pctBadge(pct)}`}>
    {pct === null ? '—' : `${pct} %`}
  </span>
)

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const dowOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return DOW_RU[new Date(y, m - 1, d).getDay()]
}

// Понедельник недели, в которую попадает дата
const startOfWeek = (d: Date): Date => {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (res.getDay() + 6) % 7 // Пн=0 … Вс=6
  res.setDate(res.getDate() - shift)
  return res
}

const addDays = (d: Date, n: number): Date => {
  const res = new Date(d)
  res.setDate(res.getDate() + n)
  return res
}

const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`

type Mode = 'month' | 'week'

export default function LoadTab() {
  const now = new Date()
  const [mode, setMode] = useState<Mode>('month')
  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [data, setData] = useState<MasterLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const todayStr = dateToStr(now)
  // Колонка «до сегодня» — только если период захватывает будущее (иначе равна общей)
  const showPast =
    mode === 'month'
      ? month === now.getMonth() && year === now.getFullYear()
      : todayStr >= dateToStr(weekStart) && todayStr < dateToStr(weekEnd)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        mode === 'month'
          ? await getMasterLoad(month, year)
          : await getMasterLoadRange(dateToStr(weekStart), dateToStr(addDays(weekStart, 6))),
      )
    } catch {
      setData(null)
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [mode, month, year, weekStart])

  useEffect(() => {
    load()
  }, [load])

  const colSpan = showPast ? 7 : 6

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
        mode === m
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  const isCurrentWeek = dateToStr(weekStart) === dateToStr(startOfWeek(now))

  return (
    <>
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap sticky top-0 z-40">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {modeBtn('month', 'Месяц')}
            {modeBtn('week', 'Неделя')}
          </div>
          {mode === 'month' ? (
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-sm"
                aria-label="Предыдущая неделя"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[170px] text-center">
                {fmtShort(weekStart)} – {fmtShort(weekEnd)}.{weekEnd.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-sm"
                aria-label="Следующая неделя"
              >
                ›
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-xs text-gray-600"
                >
                  Текущая
                </button>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">
          Капацита = часы салона − блоки «Nepracovní doba» в календаре · Занято = брони (кроме
          отменённых)
        </span>
      </div>

      <StatSection title="Загрузка мастеров по слотам" id="master-load" defaultOpen>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-red-600 py-8 text-center">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">Нет данных за выбранный период.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
              <thead>
                <tr>
                  <Cell title="Мастер" asHeader />
                  <Cell title="Раб. дни" asHeader />
                  <Cell title="Капацита" asHeader />
                  <Cell title="Занято" asHeader />
                  <Cell title="Брони" asHeader />
                  <Cell title="Загрузка" asHeader />
                  {showPast && <Cell title="Загрузка до сегодня" asHeader />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <LoadRow
                    key={r.employeeId}
                    row={r}
                    showPast={showPast}
                    colSpan={colSpan}
                    expanded={expanded === r.employeeId}
                    onToggle={() =>
                      setExpanded(expanded === r.employeeId ? null : r.employeeId)
                    }
                  />
                ))}
                <tr className="bg-gray-50 font-bold">
                  <Cell title="Итого" className="font-bold" />
                  <Cell title={String(data.totals.workingDays)} className="font-bold" />
                  <Cell title={fmtHours(data.totals.capacityMin)} className="font-bold" />
                  <Cell title={fmtHours(data.totals.bookedMin)} className="font-bold" />
                  <Cell title={String(data.totals.bookings)} className="font-bold" />
                  <td className="p-4 border-b border-blue-gray-50">
                    <PctChip pct={data.totals.pct} />
                  </td>
                  {showPast && (
                    <td className="p-4 border-b border-blue-gray-50">
                      <PctChip pct={data.totals.pastPct} />
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>
    </>
  )
}

function LoadRow({
  row,
  showPast,
  colSpan,
  expanded,
  onToggle,
}: {
  row: MasterLoadRow
  showPast: boolean
  colSpan: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-blue-gray-50">
          <span className="flex items-center gap-2 font-medium text-blue-gray-900">
            <span className="text-primary">{expanded ? '−' : '+'}</span>
            {row.name}
          </span>
        </td>
        <Cell title={String(row.workingDays)} />
        <Cell title={fmtHours(row.capacityMin)} />
        <Cell title={fmtHours(row.bookedMin)} />
        <Cell title={String(row.bookings)} />
        <td className="p-4 border-b border-blue-gray-50">
          <PctChip pct={row.pct} />
        </td>
        {showPast && (
          <td className="p-4 border-b border-blue-gray-50">
            <PctChip pct={row.pastPct} />
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colSpan} className="p-0 border-b border-blue-gray-50 bg-gray-50">
            <div className="p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="w-full text-left table-auto min-w-max">
                  <thead>
                    <tr>
                      <Cell title="День" asHeader />
                      <Cell title="Капацита" asHeader />
                      <Cell title="Блоки" asHeader />
                      <Cell title="Занято" asHeader />
                      <Cell title="Брони" asHeader />
                      <Cell title="Загрузка" asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {row.days.map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 border-b border-blue-gray-50">
                          <span className="block font-sans text-sm font-medium text-blue-gray-900">
                            {fmtDate(d.date)}{' '}
                            <span className="text-xs text-gray-400">{dowOf(d.date)}</span>
                          </span>
                        </td>
                        <Cell title={fmtHours(d.capacityMin)} />
                        <Cell title={d.blockedMin > 0 ? fmtHours(d.blockedMin) : '—'} />
                        <Cell title={fmtHours(d.bookedMin)} />
                        <Cell title={String(d.bookings)} />
                        <td className="p-4 border-b border-blue-gray-50">
                          <PctChip pct={d.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
