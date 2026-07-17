// Модал «Deník kalendáře» — журнал действий админов над бронями и блоками
// (создание / перенос / смена статуса / смена услуги / правка / удаление брони +
// создание / изменение / удаление блока). Только чтение; открывается кнопкой в
// тулбаре календаря, видной ТОЛЬКО владельцу. Записи создаёт движок booking-engine.

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCalendarLogs, type CalendarLog } from '../fetch/calendarLog'
import { ModalShell } from './ui'
import { inputCls } from './helpers'

// Метаданные типа действия: чешский лейбл + классы бейджа (light + dark)
const ACTION_META: Record<string, { label: string; cls: string }> = {
  booking_create: { label: 'Nová rezervace', cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
  booking_move: { label: 'Přesun', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  booking_status: { label: 'Stav', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' },
  booking_service: { label: 'Změna služby', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  booking_edit: { label: 'Úprava', cls: 'bg-gray-200 text-gray-600 dark:bg-[#3a3a38] dark:text-gray-300' },
  booking_delete: { label: 'Smazání', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  block_create: { label: 'Nový blok', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
  block_edit: { label: 'Úprava bloku', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  block_delete: { label: 'Smazání bloku', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
}

const actionMeta = (a: string) =>
  ACTION_META[a] || { label: a, cls: 'bg-gray-200 text-gray-600 dark:bg-[#3a3a38] dark:text-gray-300' }

// Относительное время «před 5 min» + полная дата в title
const relTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `před ${h} h`
  const d = Math.floor(h / 24)
  return `před ${d} dny`
}
const fullTime = (iso: string): string =>
  new Date(iso).toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

// Разворот деталей: перенос/статус — наглядно «старое → новое», остальное — список
const DetailBlock = ({ log }: { log: CalendarLog }) => {
  const d = log.details || {}
  const line = 'text-[12px] text-gray-600 dark:text-gray-400'
  if (log.action === 'booking_move' && d.from && d.to) {
    const f = d.from as { date?: string; time?: string; employee?: string }
    const t = d.to as { date?: string; time?: string; employee?: string }
    return (
      <div className="mt-1.5 space-y-0.5">
        <div className={line}>Z: {f.date} {f.time} · {f.employee}</div>
        <div className={line}>Na: {t.date} {t.time} · {t.employee}</div>
      </div>
    )
  }
  if (log.action === 'booking_status') {
    return (
      <div className={`mt-1.5 ${line}`}>
        {String(d.prevStatus ?? '?')} → {String(d.status ?? '?')}
      </div>
    )
  }
  const entries = Object.entries(d).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return null
  return (
    <div className="mt-1.5 space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className={line}>
          <span className="font-semibold">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </div>
      ))}
    </div>
  )
}

const LogRow = ({
  log,
  open,
  onToggle,
}: {
  log: CalendarLog
  open: boolean
  onToggle: () => void
}) => {
  const meta = actionMeta(log.action)
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-300 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:hover:border-[#4f4f4c]"
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
        <span className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 dark:bg-[#3a3a38] dark:text-gray-200">
          {log.actorName || 'neznámý admin'}
        </span>
        <span
          className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500"
          title={fullTime(log.createdAt)}
        >
          {relTime(log.createdAt)}
        </span>
      </div>
      <div className="mt-1 text-sm text-gray-800 dark:text-gray-300">{log.summary || '—'}</div>
      {open && <DetailBlock log={log} />}
    </button>
  )
}

type EntityTab = 'all' | 'booking' | 'block'

export const AuditLogModal = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<EntityTab>('all')
  const [actor, setActor] = useState('')
  const [actorQ, setActorQ] = useState('')
  const [rows, setRows] = useState<CalendarLog[]>([])
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  // последовательность — ответ устаревшего запроса не перетирает свежий фильтр
  const seq = useRef(0)

  // дебаунс поиска по имени админа
  useEffect(() => {
    const t = setTimeout(() => setActorQ(actor.trim()), 300)
    return () => clearTimeout(t)
  }, [actor])

  const load = useCallback(
    async (p: number, append: boolean) => {
      const id = ++seq.current
      setLoading(true)
      setError(null)
      try {
        const res = await fetchCalendarLogs({
          page: p,
          // без фильтра по имени — последние 10 действий всех админов;
          // при поиске конкретного админа показываем больше его записей
          pageSize: actorQ ? 40 : 10,
          entityType: tab === 'all' ? undefined : tab,
          actor: actorQ || undefined,
        })
        if (seq.current !== id) return
        setRows((prev) => (append ? [...prev, ...res.rows] : res.rows))
        setPage(p)
        setPageCount(res.pageCount)
        setTotal(res.total)
      } catch (e) {
        if (seq.current === id) setError((e as Error).message)
      } finally {
        if (seq.current === id) setLoading(false)
      }
    },
    [tab, actorQ],
  )

  // смена фильтра (tab/actor) → загрузка первой страницы заново
  useEffect(() => {
    load(1, false)
  }, [load])

  const tabBtn = (t: EntityTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        tab === t
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#2e2e2c] dark:text-gray-300 dark:hover:bg-[#3a3a38]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <ModalShell title="Deník kalendáře" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-1.5">
        {tabBtn('all', 'Vše')}
        {tabBtn('booking', 'Rezervace')}
        {tabBtn('block', 'Bloky')}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">{total} záznamů</span>
      </div>
      <input
        type="search"
        value={actor}
        onChange={(e) => setActor(e.target.value)}
        placeholder="Filtr podle jména administrátora…"
        className={`${inputCls} mt-2`}
      />

      <div className="mt-3 space-y-1.5">
        {error && <p className="text-[12px] text-red-500">Chyba: {error}</p>}
        {!error && rows.length === 0 && !loading && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Žádné akce.</p>
        )}
        {rows.map((log) => (
          <LogRow
            key={log.documentId}
            log={log}
            open={open === log.documentId}
            onToggle={() => setOpen((cur) => (cur === log.documentId ? null : log.documentId))}
          />
        ))}
        {loading && <p className="text-[12px] text-gray-400 dark:text-gray-500">Načítám…</p>}
        {!loading && page < pageCount && (
          <button
            type="button"
            onClick={() => load(page + 1, true)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
          >
            Načíst starší
          </button>
        )}
      </div>
    </ModalShell>
  )
}
