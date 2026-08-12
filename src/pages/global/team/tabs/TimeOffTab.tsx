import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { mutedCls, toolbarCardCls } from '../../../../ui/kit'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  fetchTimeOffs,
  buildSummaries,
  daysInMonth,
  TYPE_LABELS,
  type TimeOffRecord,
  type EmployeeSummary,
  type TimeOffType,
} from '../fetch/timeOff'

const TYPE_BADGE: Record<TimeOffType, string> = {
  sick: 'bg-warn-bg text-warn',
  vacation: 'bg-info-bg text-info',
  personal: 'bg-warn-bg text-warn',
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function TimeOffTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [records, setRecords] = useState<TimeOffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTimeOffs(month, year)
      setRecords(data)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    load()
  }, [load])

  const summaries = buildSummaries(records, month, year)
  const totals = summaries.reduce(
    (acc, s) => ({
      sick: acc.sick + s.sick,
      vacation: acc.vacation + s.vacation,
      personal: acc.personal + s.personal,
      total: acc.total + s.total,
    }),
    { sick: 0, vacation: 0, personal: 0, total: 0 },
  )

  return (
    <>
      <div className={toolbarCardCls}>
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <span className={mutedCls}>
          Počítají se kalendářní dny včetně víkendů (od–do včetně)
        </span>
      </div>

      <StatSection
        title="Сводка по сотрудникам"
        id="timeoff-summary"
        count={summaries.length}
        defaultOpen
      >
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Načítání…
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            За выбранный месяц записей нет.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr>
                  <Cell title="Сотрудник" asHeader />
                  <Cell title="Больничный" asHeader className="text-right" />
                  <Cell title="Отпуск" asHeader className="text-right" />
                  <Cell title="Личный" asHeader className="text-right" />
                  <Cell title="Всего дней" asHeader className="text-right" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <SummaryRow
                    key={s.documentId}
                    summary={s}
                    month={month}
                    year={year}
                    expanded={expanded === s.documentId}
                    onToggle={() =>
                      setExpanded(expanded === s.documentId ? null : s.documentId)
                    }
                  />
                ))}
                <tr className="bg-surface-tile">
                  <Cell title="Итого" className="text-[13px] font-extrabold text-ink-body" />
                  <Cell
                    title={String(totals.sick)}
                    className="text-right font-bold text-warn"
                  />
                  <Cell
                    title={String(totals.vacation)}
                    className="text-right font-bold text-info"
                  />
                  <Cell
                    title={String(totals.personal)}
                    className="text-right font-bold text-warn"
                  />
                  <Cell
                    title={String(totals.total)}
                    className="text-right text-[14px] font-extrabold text-brand-dark"
                  />
                </tr>
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>
    </>
  )
}

function SummaryRow({
  summary,
  month,
  year,
  expanded,
  onToggle,
}: {
  summary: EmployeeSummary
  month: number
  year: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="hover:bg-surface-hover transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-[10px] border-b border-line-soft">
          <span className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <span className="w-[18px] h-[18px] rounded-md bg-brand-tint text-brand-dark text-[12px] font-extrabold inline-flex items-center justify-center shrink-0">
              {expanded ? '−' : '+'}
            </span>
            {summary.name}
            <span className="text-[11px] font-bold text-ink-faint">
              ({summary.records.length})
            </span>
          </span>
        </td>
        <Cell
          title={summary.sick ? String(summary.sick) : '—'}
          className={`text-right ${summary.sick ? 'text-warn font-bold' : 'text-ink-disabled'}`}
        />
        <Cell
          title={summary.vacation ? String(summary.vacation) : '—'}
          className={`text-right ${summary.vacation ? 'text-info font-bold' : 'text-ink-disabled'}`}
        />
        <Cell
          title={summary.personal ? String(summary.personal) : '—'}
          className={`text-right ${summary.personal ? 'text-warn font-bold' : 'text-ink-disabled'}`}
        />
        <Cell
          title={String(summary.total)}
          className="text-right text-[14px] font-extrabold text-brand-dark"
        />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-line-soft bg-surface-tile">
            <div className="p-4 space-y-2">
              {summary.records.map((rec) => (
                <div
                  key={rec.documentId}
                  className="flex items-center gap-3 flex-wrap bg-white border border-line rounded-lg px-3 py-2.5"
                >
                  <span
                    className={`px-[7px] py-0.5 rounded-md text-[11px] font-bold ${TYPE_BADGE[rec.type]}`}
                  >
                    {TYPE_LABELS[rec.type]}
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink-body">
                    {fmtDate(rec.startDate)} — {fmtDate(rec.endDate)}
                  </span>
                  <span className="text-[12px] font-semibold text-ink-soft">
                    {daysInMonth(rec, month, year)} дн. в этом месяце
                  </span>
                  <span
                    className={`text-[12px] font-bold ${rec.paid ? 'text-pos' : 'text-ink-faint'}`}
                  >
                    {rec.paid ? 'Оплачивается' : 'Без оплаты'}
                  </span>
                  {rec.comment && (
                    <span className="text-[12px] font-medium text-ink-soft italic">
                      {rec.comment}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
