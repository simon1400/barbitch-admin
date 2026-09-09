import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  badgeNegCls,
  badgePosCls,
  btnNeutralCls,
  cardCls,
  hintCls,
  iconBtnCls,
  pillCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import {
  getMasterLoad,
  getMasterLoadRange,
  fmtHours,
  type MasterLoadResult,
  type MasterLoadRow,
} from '../fetch/masterLoad'
import {
  addDays,
  DOW_RU_SHORT,
  dowOfYmd,
  fmtCsDate,
  fmtCsShort,
  startOfWeek,
  todayDate,
  ymd,
} from '../../../../utils/date'

const pctBadgeCls = (pct: number | null): string => {
  if (pct === null) return 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-ink-faint bg-surface-input'
  if (pct >= 75) return badgePosCls
  if (pct >= 45) return 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-warn bg-warn-bg'
  return badgeNegCls
}

const PctChip = ({ pct }: { pct: number | null }) => (
  <span className={`whitespace-nowrap ${pctBadgeCls(pct)}`}>{pct === null ? '—' : `${pct} %`}</span>
)

const dowOf = (date: string) => DOW_RU_SHORT[dowOfYmd(date)]

type Mode = 'month' | 'week'

export default function LoadTab() {
  const now = todayDate()
  const [mode, setMode] = useState<Mode>('month')
  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(todayDate()))
  const [data, setData] = useState<MasterLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const todayStr = ymd(now)
  // Колонка «до сегодня» — только если период захватывает будущее (иначе равна общей)
  const showPast =
    mode === 'month'
      ? month === now.getMonth() && year === now.getFullYear()
      : todayStr >= ymd(weekStart) && todayStr < ymd(weekEnd)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        mode === 'month'
          ? await getMasterLoad(month, year)
          : await getMasterLoadRange(ymd(weekStart), ymd(addDays(weekStart, 6))),
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
    <button type="button" onClick={() => setMode(m)} className={pillCls(mode === m)}>
      {label}
    </button>
  )

  const isCurrentWeek = ymd(weekStart) === ymd(startOfWeek(now))

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
              <span className="text-[13px] font-bold text-ink-body whitespace-nowrap min-w-[150px] text-center">
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
        <span className={hintCls}>
          Капацита = часы салона − блоки «Nepracovní doba» в календаре · Занято = брони (кроме
          отменённых)
        </span>
      </div>

      <StatSection title="Загрузка мастеров по слотам" id="master-load" defaultOpen>
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">Načítání…</div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] font-semibold text-brand-alert">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Нет данных за выбранный период.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left">
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
                <tr className="bg-surface-tile font-bold">
                  <Cell title="Итого" className="font-bold" />
                  <Cell title={String(data.totals.workingDays)} className="font-bold" />
                  <Cell title={fmtHours(data.totals.capacityMin)} className="font-bold" />
                  <Cell title={fmtHours(data.totals.bookedMin)} className="font-bold" />
                  <Cell title={String(data.totals.bookings)} className="font-bold" />
                  <td className="p-4 border-b border-line-soft">
                    <PctChip pct={data.totals.pct} />
                  </td>
                  {showPast && (
                    <td className="p-4 border-b border-line-soft">
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
      <tr className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-line-soft">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
            <span className="text-brand">{expanded ? '−' : '+'}</span>
            {row.name}
          </span>
        </td>
        <Cell title={String(row.workingDays)} />
        <Cell title={fmtHours(row.capacityMin)} />
        <Cell title={fmtHours(row.bookedMin)} />
        <Cell title={String(row.bookings)} />
        <td className="p-4 border-b border-line-soft">
          <PctChip pct={row.pct} />
        </td>
        {showPast && (
          <td className="p-4 border-b border-line-soft">
            <PctChip pct={row.pastPct} />
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colSpan} className="p-0 border-b border-line-soft bg-surface-tile">
            <div className="p-4">
              <div className={`${cardCls} overflow-x-auto`}>
                <table className="w-full text-left">
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
                      <tr key={d.date} className="hover:bg-surface-hover transition-colors">
                        <td className="p-4 border-b border-line-soft">
                          <span className="block text-[13.5px] font-bold text-ink">
                            {fmtCsDate(d.date)}{' '}
                            <span className="text-[11px] font-semibold text-ink-faint">
                              {dowOf(d.date)}
                            </span>
                          </span>
                        </td>
                        <Cell title={fmtHours(d.capacityMin)} />
                        <Cell title={d.blockedMin > 0 ? fmtHours(d.blockedMin) : '—'} />
                        <Cell title={fmtHours(d.bookedMin)} />
                        <Cell title={String(d.bookings)} />
                        <td className="p-4 border-b border-line-soft">
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
