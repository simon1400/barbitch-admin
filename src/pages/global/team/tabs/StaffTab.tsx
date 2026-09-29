import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  badgeFaintCls,
  badgeMutedCls,
  badgeWarnCls,
  btnNeutralCls,
  btnPinkCls,
  cardPadCls,
  mutedCls,
  pillCls,
  selectCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import { fmtCsDate } from '../../../../utils/date'
import {
  FLAG_LABEL,
  POSITION_LABEL,
  fetchStaffList,
  filterStaff,
  positionLabel,
  type ListFilter,
  type Position,
  type StaffRow,
} from '../fetch/staff'
import { StaffAvatar } from './staff/ui'

const STATUS_PILLS: { key: ListFilter; label: string }[] = [
  { key: 'active', label: 'Работают' },
  { key: 'left', label: 'Ушли' },
  { key: 'all', label: 'Все' },
]

// «Команда → Сотрудники» (s226): список карточек, бейджи «чего не хватает»,
// переход в карточку и «Добавить сотрудника». Только руководство (owner + manager);
// владелец для управляющей скрыт сервером.
export default function StaffTab() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ListFilter>('active')
  const [position, setPosition] = useState<Position | 'all'>('all')
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStaffList()
      if (my === seq.current) setRows(Array.isArray(res?.rows) ? res.rows : [])
    } catch (e) {
      if (my === seq.current) {
        setRows([])
        setError((e as Error).message)
      }
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = filterStaff(rows, status, position)
  const leftCount = rows.filter((r) => r.left).length

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_PILLS.map((p) => (
            <button key={p.key} type="button" className={pillCls(status === p.key)} onClick={() => setStatus(p.key)}>
              {p.label}
              {p.key === 'left' && leftCount ? ` · ${leftCount}` : ''}
            </button>
          ))}
          <select
            aria-label="Должность"
            className={selectCls}
            value={position}
            onChange={(e) => setPosition(e.target.value as Position | 'all')}
          >
            <option value="all">Все должности</option>
            {(Object.keys(POSITION_LABEL) as Position[]).map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnNeutralCls} onClick={load} disabled={loading}>
            Обновить
          </button>
          <Link to="/global/team/staff/new" className={btnPinkCls}>
            + Добавить сотрудника
          </Link>
        </div>
      </div>

      <div className={cardPadCls} data-testid="staff-list">
        {loading && !rows.length ? (
          <div className="py-10 text-center text-[13px] font-semibold text-ink-faint">Načítání…</div>
        ) : error ? (
          <div role="alert" className="py-10 text-center text-[13px] font-semibold text-neg">
            {error}
          </div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center text-[13px] font-semibold text-ink-faint">Никого не найдено.</div>
        ) : (
          shown.map((r, idx) => <StaffListRow key={r.documentId} row={r} first={idx === 0} />)
        )}
      </div>
    </>
  )
}

function StaffListRow({ row, first }: { row: StaffRow; first: boolean }) {
  return (
    <Link
      to={`/global/team/staff/${encodeURIComponent(row.documentId)}`}
      data-staff={row.documentId}
      className={`flex items-center gap-3 py-[10px] px-2 -mx-2 rounded-lg transition-colors hover:bg-surface-hover ${
        first ? '' : 'border-t border-line-soft'
      } ${row.left ? 'opacity-60' : ''}`}
    >
      <StaffAvatar name={row.name} photo={row.photo} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-bold text-ink">{row.name}</span>
          <span className="text-[12px] font-semibold text-ink-soft">{positionLabel(row.position)}</span>
          {row.position === 'master' && row.tier === 'junior' && <span className={badgeMutedCls}>junior</span>}
          {!row.published && <span className={badgeWarnCls}>не опубликована</span>}
        </div>
        {row.flags.length > 0 && (
          <div className="mt-1 flex gap-1.5 flex-wrap">
            {row.flags.map((f) => (
              <span key={f} className={badgeWarnCls}>
                {FLAG_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        {row.left ? (
          <span className={badgeFaintCls}>ушёл(ла){row.leftAt ? ` ${fmtCsDate(row.leftAt)}` : ''}</span>
        ) : (
          row.hiredAt && <span className={mutedCls}>с {fmtCsDate(row.hiredAt)}</span>
        )}
      </div>
    </Link>
  )
}
