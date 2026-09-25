import { useMonthYear } from '../../../../hooks/useMonthYear'
import { fmtCsDate, todayYmd } from '../../../../utils/date'
import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { badgeMutedCls, btnDangerCls, btnNeutralCls, mutedCls, toolbarCardCls } from '../../../../ui/kit'
import { fetchInternalRecipients, type InternalRecipient } from '../../../../lib/personals'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  fetchTimeOffs,
  buildSummaries,
  daysInMonth,
  deleteTimeOff,
  TYPE_LABELS,
  type TimeOffRecord,
  type TimeOffSaveResult,
  type EmployeeSummary,
  type TimeOffType,
} from '../fetch/timeOff'
import { TimeOffForm } from './timeoff/TimeOffForm'
import { ConflictList } from './timeoff/ConflictList'

const TYPE_BADGE: Record<TimeOffType, string> = {
  sick: 'bg-warn-bg text-warn',
  vacation: 'bg-info-bg text-info',
  personal: 'bg-warn-bg text-warn',
}

const fmtDate = fmtCsDate

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Дата формы по умолчанию: сегодня в текущем месяце, иначе 1-е число открытого месяца. */
const defaultDateFor = (month: number, year: number, today: string) => {
  const key = `${year}-${pad2(month + 1)}`
  return today.startsWith(key) ? today : `${key}-01`
}

const blocksWord = (n: number) => (n === 1 ? 'блок' : n >= 2 && n <= 4 ? 'блока' : 'блоков')

// «Больничные / отпуска» (s216, Фаза D плана «Управляющая»): ввод и правка из
// админки (руководство). Мастеру запись сразу ставит серию блоков в календаре.
export default function TimeOffTab() {
  const { month, setMonth, year, setYear } = useMonthYear()
  const [records, setRecords] = useState<TimeOffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [staff, setStaff] = useState<InternalRecipient[]>([])
  const [editing, setEditing] = useState<TimeOffRecord | null>(null)
  const [saved, setSaved] = useState<{ text: string; res: TimeOffSaveResult } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await fetchTimeOffs(month, year)
      setRecords(data)
    } catch {
      setRecords([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchInternalRecipients()
      .then(setStaff)
      .catch(() => setStaff([]))
  }, [])

  const onSaved = (res: TimeOffSaveResult, wasEdit: boolean) => {
    const r = res.row
    const period = r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} — ${fmtDate(r.endDate)}`
    const blocks = res.blocks > 0 ? ` В календаре: ${res.blocks} ${blocksWord(res.blocks)}.` : ''
    setSaved({
      text: `${wasEdit ? 'Изменено' : 'Добавлено'}: ${TYPE_LABELS[r.type]} · ${r.personal?.name ?? ''} · ${period}.${blocks}`,
      res,
    })
    setEditing(null)
    setError(null)
    load()
  }

  const startEdit = (rec: TimeOffRecord) => {
    setSaved(null)
    setEditing(rec)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (rec: TimeOffRecord) => {
    const what = `${TYPE_LABELS[rec.type]} ${rec.personal?.name ?? ''} ${fmtDate(rec.startDate)} — ${fmtDate(rec.endDate)}`
    const tail = rec.blockSeriesKey ? ' Блоки этой записи в календаре тоже удалятся.' : ''
    if (!window.confirm(`Удалить запись «${what}»?${tail}`)) return
    setDeleting(rec.documentId)
    setError(null)
    try {
      await deleteTimeOff(rec.documentId)
      setSaved(null)
      if (editing?.documentId === rec.documentId) setEditing(null)
      setRecords((prev) => prev.filter((r) => r.documentId !== rec.documentId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeleting(null)
    }
  }

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

      <TimeOffForm
        key={editing ? `edit:${editing.documentId}` : `new:${year}-${month}`}
        staff={staff}
        editing={editing}
        defaultDate={defaultDateFor(month, year, todayYmd())}
        onSaved={onSaved}
        onCancel={editing ? () => setEditing(null) : undefined}
      />

      {saved && (
        <div role="status" className="mb-3.5 text-[12.5px] font-semibold text-pos" data-testid="timeoff-saved">
          {saved.text}
          <ConflictList
            rows={saved.res.conflicts}
            title={`Брони на эти дни (${saved.res.conflicts.length}) остались — перенесите или отмените их в календаре:`}
          />
        </div>
      )}
      {error && (
        <div role="alert" className="mb-3.5 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}

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
        ) : loadError ? (
          <div role="alert" className="py-12 text-center text-[13px] font-semibold text-neg">
            Не удалось загрузить записи — обновите страницу.
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
                    onEdit={startEdit}
                    onDelete={remove}
                    deleting={deleting}
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
  onEdit,
  onDelete,
  deleting,
}: {
  summary: EmployeeSummary
  month: number
  year: number
  expanded: boolean
  onToggle: () => void
  onEdit: (rec: TimeOffRecord) => void
  onDelete: (rec: TimeOffRecord) => void
  deleting: string | null
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
                  data-record={rec.documentId}
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
                  {rec.blockSeriesKey && (
                    <span className={badgeMutedCls} title="Серия блоков в календаре на дни этой записи">
                      блоки в календаре
                    </span>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} onClick={() => onEdit(rec)}>
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={`${btnDangerCls} !px-2.5 !py-1`}
                      disabled={deleting === rec.documentId}
                      onClick={() => onDelete(rec)}
                    >
                      {deleting === rec.documentId ? '…' : 'Удалить'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
