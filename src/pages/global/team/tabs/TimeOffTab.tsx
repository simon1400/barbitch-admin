import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
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
  sick: 'bg-red-100 text-red-700',
  vacation: 'bg-blue-100 text-blue-700',
  personal: 'bg-amber-100 text-amber-700',
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
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap sticky top-0 z-40">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <span className="text-xs text-gray-400">Považují se pouze pracovní dny (Po–Pá)</span>
      </div>

      <StatSection title="Сводка по сотрудникам" id="timeoff-summary" defaultOpen>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : summaries.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">За выбранный месяц записей нет.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
              <thead>
                <tr>
                  <Cell title="Сотрудник" asHeader />
                  <Cell title="Больничный" asHeader />
                  <Cell title="Отпуск" asHeader />
                  <Cell title="Личный" asHeader />
                  <Cell title="Всего дней" asHeader />
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
                <tr className="bg-gray-50 font-bold">
                  <Cell title="Итого" className="font-bold" />
                  <Cell title={String(totals.sick)} className="font-bold text-red-700" />
                  <Cell title={String(totals.vacation)} className="font-bold text-blue-700" />
                  <Cell title={String(totals.personal)} className="font-bold text-amber-700" />
                  <Cell title={String(totals.total)} className="font-bold text-primary" />
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
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-blue-gray-50">
          <span className="flex items-center gap-2 font-medium text-blue-gray-900">
            <span className="text-primary">{expanded ? '−' : '+'}</span>
            {summary.name}
            <span className="text-xs text-gray-400">({summary.records.length})</span>
          </span>
        </td>
        <Cell title={summary.sick ? String(summary.sick) : '—'} />
        <Cell title={summary.vacation ? String(summary.vacation) : '—'} />
        <Cell title={summary.personal ? String(summary.personal) : '—'} />
        <Cell title={String(summary.total)} className="font-semibold text-primary" />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-blue-gray-50 bg-gray-50">
            <div className="p-4 space-y-2">
              {summary.records.map((rec) => (
                <div
                  key={rec.documentId}
                  className="flex items-center gap-3 flex-wrap bg-white rounded-lg p-3 shadow-sm"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_BADGE[rec.type]}`}
                  >
                    {TYPE_LABELS[rec.type]}
                  </span>
                  <span className="text-sm text-gray-700">
                    {fmtDate(rec.startDate)} — {fmtDate(rec.endDate)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {daysInMonth(rec, month, year)} прац. дн. в этом месяце
                  </span>
                  <span
                    className={`text-xs font-medium ${rec.paid ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {rec.paid ? 'Оплачивается' : 'Без оплаты'}
                  </span>
                  {rec.comment && (
                    <span className="text-xs text-gray-500 italic">{rec.comment}</span>
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
