import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { dateToStr } from '../fetch/masterLoad'
import {
  getScheduleGaps,
  DEAD_MAX,
  DEAD_MIN,
  type MasterGapsRow,
} from '../fetch/scheduleGaps'

const startOfWeek = (d: Date): Date => {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  res.setDate(res.getDate() - ((res.getDay() + 6) % 7))
  return res
}

const addDays = (d: Date, n: number): Date => {
  const res = new Date(d)
  res.setDate(res.getDate() + n)
  return res
}

const fmtShort = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`

const fmtH = (min: number) => `${Math.round((min / 60) * 10) / 10} ч`

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const fmtDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} ${DOW_RU[new Date(y, m - 1, d).getDay()]}`
}

type Mode = 'month' | 'week'

export default function GapsTab() {
  const now = new Date()
  const [mode, setMode] = useState<Mode>('week')
  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [rows, setRows] = useState<MasterGapsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const isCurrentWeek = dateToStr(weekStart) === dateToStr(startOfWeek(now))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fromStr =
        mode === 'month'
          ? dateToStr(new Date(year, month, 1))
          : dateToStr(weekStart)
      const toStr =
        mode === 'month'
          ? dateToStr(new Date(year, month + 1, 0))
          : dateToStr(addDays(weekStart, 6))
      const data = await getScheduleGaps(fromStr, toStr)
      setRows(data.sort((a, b) => b.deadMin - a.deadMin))
    } catch {
      setRows([])
      setError('Не удалось загрузить данные из Noona')
    } finally {
      setLoading(false)
    }
  }, [mode, month, year, weekStart])

  useEffect(() => {
    load()
  }, [load])

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
      </div>

      <StatSection title="Окна в расписании" id="schedule-gaps" defaultOpen>
        <p className="text-xs text-gray-400 mb-4">
          Мёртвое окно = свободные {DEAD_MIN}–{DEAD_MAX} мин между бронями — в них трудно продать
          услугу. Зелёные окна (больше {DEAD_MAX} мин) ещё продаваемы.
        </p>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-red-600 py-8 text-center">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">Нет данных за неделю.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
              <thead>
                <tr>
                  <Cell title="Мастер" asHeader />
                  <Cell title="Занято" asHeader />
                  <Cell title="Свободно" asHeader />
                  <Cell title="Мёртвых окон" asHeader />
                  <Cell title="Мёртвое время" asHeader />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <MasterRow
                    key={r.employeeId}
                    row={r}
                    expanded={expanded === r.employeeId}
                    onToggle={() => setExpanded(expanded === r.employeeId ? null : r.employeeId)}
                  />
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>
    </>
  )
}

function MasterRow({
  row,
  expanded,
  onToggle,
}: {
  row: MasterGapsRow
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
        <Cell title={fmtH(row.bookedMin)} />
        <Cell title={fmtH(row.freeMin)} />
        <Cell
          title={String(row.deadCount)}
          className={row.deadCount > 0 ? 'text-red-600 font-semibold' : ''}
        />
        <Cell title={row.deadMin ? fmtH(row.deadMin) : '—'} />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-blue-gray-50 bg-gray-50">
            <div className="p-4">
              {row.days.length === 0 ? (
                <div className="text-sm text-gray-500">Нет рабочих дней на этой неделе.</div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                  <table className="w-full text-left table-auto min-w-max">
                    <thead>
                      <tr>
                        <Cell title="День" asHeader />
                        <Cell title="Занято" asHeader />
                        <Cell title="Свободно" asHeader />
                        <Cell title="Мёртвых" asHeader />
                        <Cell title="Окна" asHeader />
                      </tr>
                    </thead>
                    <tbody>
                      {row.days.map((d) => (
                        <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                          <Cell title={fmtDay(d.date)} className="font-medium" />
                          <Cell title={fmtH(d.bookedMin)} />
                          <Cell title={d.freeMin ? fmtH(d.freeMin) : '—'} />
                          <Cell
                            title={d.deadCount ? String(d.deadCount) : '—'}
                            className={d.deadCount ? 'text-red-600 font-semibold' : ''}
                          />
                          <td className="p-4 border-b border-blue-gray-50">
                            {d.gaps.length === 0 ? (
                              <span className="text-xs text-green-600 font-medium">
                                без окон — день забит
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                {d.gaps.map((g) => (
                                  <span
                                    key={`${d.date}-${g.start}`}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      g.dead
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}
                                    title={g.dead ? 'Мёртвое окно' : 'Большое свободное окно'}
                                  >
                                    {g.start}–{g.end} ({g.durationMin} мин)
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
