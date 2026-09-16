import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  bodyBoldCls,
  btnNeutralCls,
  cardCls,
  hintCls,
  iconBtnCls,
  pillCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import {
  addDays,
  DOW_RU_SHORT,
  dowOfYmd,
  fmtCsShort,
  monthEndYmd,
  startOfWeek,
  todayDate,
  ymd,
} from '../../../../utils/date'
import {
  getScheduleGaps,
  DEAD_MAX,
  DEAD_MIN,
  type MasterGapsRow,
} from '../fetch/scheduleGaps'

const fmtH = (min: number) => `${Math.round((min / 60) * 10) / 10} ч`

const fmtDay = (date: string) => {
  const [, m, d] = date.split('-')
  return `${d}.${m} ${DOW_RU_SHORT[dowOfYmd(date)]}`
}

type Mode = 'month' | 'week'

export default function GapsTab() {
  const now = todayDate()
  const [mode, setMode] = useState<Mode>('week')
  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(todayDate()))
  const [rows, setRows] = useState<MasterGapsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const isCurrentWeek = ymd(weekStart) === ymd(startOfWeek(now))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fromStr =
        mode === 'month'
          ? ymd(new Date(year, month, 1))
          : ymd(weekStart)
      const toStr =
        mode === 'month'
          ? monthEndYmd(year, month)
          : ymd(addDays(weekStart, 6))
      const data = await getScheduleGaps(fromStr, toStr)
      setRows(data.sort((a, b) => b.deadMin - a.deadMin))
    } catch {
      setRows([])
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [mode, month, year, weekStart])

  useEffect(() => {
    load()
  }, [load])

  const modeBtn = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)} className={pillCls(mode === m)}>
      {label}
    </button>
  )

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
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
                className={`${iconBtnCls} text-[16px]`}
                aria-label="Предыдущая неделя"
              >
                ‹
              </button>
              <span className={`${bodyBoldCls} whitespace-nowrap min-w-[150px] text-center`}>
                {fmtCsShort(weekStart)} – {fmtCsShort(weekEnd)}.{weekEnd.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className={`${iconBtnCls} text-[16px]`}
                aria-label="Следующая неделя"
              >
                ›
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(todayDate()))}
                  className={btnNeutralCls}
                >
                  Текущая
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <StatSection title="Окна в расписании" id="schedule-gaps" defaultOpen>
        <p className={`m-0 mb-4 ${hintCls}`}>
          Мёртвое окно = свободные {DEAD_MIN}–{DEAD_MAX} мин между бронями — в них трудно продать
          услугу. Зелёные окна (больше {DEAD_MAX} мин) ещё продаваемы.
        </p>
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">Načítání…</div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] font-semibold text-brand-alert">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Нет данных за неделю.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left">
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
      <tr className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-line-soft">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
            <span className="text-brand">{expanded ? '−' : '+'}</span>
            {row.name}
          </span>
        </td>
        <Cell title={fmtH(row.bookedMin)} />
        <Cell title={fmtH(row.freeMin)} />
        <Cell
          title={String(row.deadCount)}
          className={row.deadCount > 0 ? 'text-neg font-bold' : ''}
        />
        <Cell title={row.deadMin ? fmtH(row.deadMin) : '—'} />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-line-soft bg-surface-tile">
            <div className="p-4">
              {row.days.length === 0 ? (
                <div className="text-[13px] font-semibold text-ink-faint">
                  Нет рабочих дней на этой неделе.
                </div>
              ) : (
                <div className={`${cardCls} overflow-x-auto`}>
                  <table className="w-full text-left">
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
                        <tr key={d.date} className="hover:bg-surface-hover transition-colors">
                          <Cell title={fmtDay(d.date)} className="font-bold text-ink" />
                          <Cell title={fmtH(d.bookedMin)} />
                          <Cell title={d.freeMin ? fmtH(d.freeMin) : '—'} />
                          <Cell
                            title={d.deadCount ? String(d.deadCount) : '—'}
                            className={d.deadCount ? 'text-neg font-bold' : ''}
                          />
                          <td className="p-4 border-b border-line-soft">
                            {d.gaps.length === 0 ? (
                              <span className="text-[12px] font-bold text-pos">
                                без окон — день забит
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                {d.gaps.map((g) => (
                                  <span
                                    key={`${d.date}-${g.start}`}
                                    className={`rounded-lg px-2.5 py-1 text-[12px] font-bold border ${
                                      g.dead
                                        ? 'bg-neg-bg text-neg border-neg-line'
                                        : 'bg-pos-bg text-pos border-pos-line'
                                    }`}
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
