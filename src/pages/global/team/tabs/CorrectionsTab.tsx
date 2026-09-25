import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMonthYear } from '../../../../hooks/useMonthYear'
import { fetchInternalRecipients, type InternalRecipient } from '../../../../lib/personals'
import { fmtCsDate, todayYmd } from '../../../../utils/date'
import { kc } from '../../../../utils/money'
import {
  badgeMutedCls,
  badgeWarnCls,
  btnDangerCls,
  mutedCls,
  selectCls,
  tileCls,
  tileLabelCls,
  tileValueCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import { Cell } from '../../../dashboard/components/Cell'
import { Select } from '../../../dashboard/components/Select'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  CORRECTION_KINDS,
  KIND_ORDER,
  SOURCE_LABELS,
  TAX_TYPE_LABELS,
  defaultDateFor,
  deleteCorrection,
  fetchCorrections,
  monthKey,
  sumLabel,
  totalsByKind,
  type CorrectionRow,
} from '../fetch/corrections'
import { CorrectionForm } from './corrections/CorrectionForm'

// «Корректировки» (s215, Фаза C плана «Управляющая»): штрафы, доп. заработок,
// списания, авансы, выплаты и налоги — из админки, а не из Strapi CM. Руководство.
export default function CorrectionsTab() {
  const { month, setMonth, year, setYear } = useMonthYear()
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staff, setStaff] = useState<InternalRecipient[]>([])
  const [who, setWho] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchCorrections(month, year))
    } catch (e) {
      setError((e as Error).message)
      setRows([])
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

  // фильтр: активные сотрудники + те, кто есть в записях месяца (в т.ч. уже ушедшие)
  const people = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of staff) m.set(p.docId, p.name)
    for (const r of rows) if (r.personal) m.set(r.personal.documentId, r.personal.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'cs'))
  }, [staff, rows])

  const visible = who ? rows.filter((r) => r.personal?.documentId === who) : rows
  const totals = totalsByKind(visible)
  const key = monthKey(month, year)

  const onCreated = (row: CorrectionRow) => {
    if (row.date?.startsWith(key)) {
      setNotice(null)
      load()
    } else {
      setNotice(`Запись добавлена в ${fmtCsDate(row.date)} — это другой месяц, здесь она не видна.`)
    }
  }

  const remove = async (row: CorrectionRow) => {
    const meta = CORRECTION_KINDS[row.kind]
    const q = `Удалить «${meta.label}» ${row.personal?.name ?? ''} ${kc(row.sum)} от ${fmtCsDate(row.date)}?`
    if (!window.confirm(q)) return
    setDeleting(row.documentId)
    setError(null)
    try {
      await deleteCorrection(row)
      setRows((prev) => prev.filter((r) => r.documentId !== row.documentId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className={toolbarCardCls}>
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <select
          name="who"
          aria-label="Сотрудник"
          className={selectCls}
          value={who}
          onChange={(e) => setWho(e.target.value)}
        >
          <option value="">Все сотрудники</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <CorrectionForm
        key={key}
        staff={staff}
        defaultDate={defaultDateFor(month, year, todayYmd())}
        onCreated={onCreated}
      />

      {notice && (
        <div role="status" className="mb-3.5 text-[12px] font-semibold text-ink-soft">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3.5">
        {KIND_ORDER.map((k) => (
          <div key={k} className={tileCls}>
            <div className={tileLabelCls}>{CORRECTION_KINDS[k].label}</div>
            <div className={tileValueCls} data-total={k}>
              {sumLabel({ kind: k, sum: totals[k] })}
            </div>
          </div>
        ))}
      </div>

      <StatSection title="Записи месяца" id="corrections" count={visible.length} defaultOpen>
        {error && (
          <div role="alert" className="mb-3 text-[12px] font-semibold text-neg">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">Загрузка…</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            За выбранный месяц записей нет.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr>
                  <Cell title="Дата" asHeader />
                  <Cell title="Сотрудник" asHeader />
                  <Cell title="Тип" asHeader />
                  <Cell title="Сумма" asHeader className="text-right" />
                  <Cell title="Комментарий" asHeader />
                  <Cell title="" asHeader />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={`${r.kind}:${r.documentId}`} data-row={r.documentId}>
                    <Cell title={fmtCsDate(r.date)} className="whitespace-nowrap" />
                    <Cell title={r.personal?.name ?? '—'} className="text-[14px] font-bold text-ink" />
                    <td className="px-3 py-[10px] border-b border-line-soft">
                      <span className="text-[13px] font-semibold text-ink-body">
                        {CORRECTION_KINDS[r.kind]?.label ?? r.kind}
                        {r.taxType ? ` · ${TAX_TYPE_LABELS[r.taxType] ?? r.taxType}` : ''}
                      </span>
                      {r.draft && <span className={`${badgeWarnCls} ml-1.5`}>черновик</span>}
                    </td>
                    <Cell
                      title={sumLabel(r)}
                      className={`text-right whitespace-nowrap ${
                        CORRECTION_KINDS[r.kind]?.effect === '−' ? 'text-neg' : ''
                      }`}
                    />
                    <Cell title={r.text || '—'} className="text-[13px]" />
                    <td className="px-3 py-[10px] border-b border-line-soft text-right">
                      {r.readOnly ? (
                        <span className={`${badgeMutedCls} whitespace-nowrap`} title="Запись ведёт календарь">
                          {SOURCE_LABELS[r.source ?? ''] ?? r.source}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`${btnDangerCls} !px-2.5 !py-1`}
                          disabled={deleting === r.documentId}
                          onClick={() => remove(r)}
                        >
                          {deleting === r.documentId ? '…' : 'Удалить'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
        <p className={`${mutedCls} mt-3 mb-0`}>
          Черновик — запись без публикации (например, списание, которое опубликует закрытие смены): в
          «Зарплатах» её пока нет и в итоги сверху она не входит.
        </p>
      </StatSection>
    </>
  )
}
