// Модал «Deník kalendáře» — журнал действий админов над бронями и блоками
// (создание / перенос / смена статуса / смена услуги / правка / удаление брони +
// создание / изменение / удаление блока + правка контактов клиента). Только чтение;
// открывается кнопкой в тулбаре календаря, видной ТОЛЬКО владельцу.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteCalendarLog, fetchCalendarLogs, type CalendarLog } from '../fetch/calendarLog'
import { ModalShell } from './ui'
import { inputCls, parseSummary } from './helpers'

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
  block_approve: {
    label: 'Blok schválen',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  block_reject: { label: 'Blok zamítnut', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  // правка контактов клиента из модала «Hledat klienta» (s205)
  client_edit: { label: 'Údaje klienta', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
}

const actionMeta = (a: string) =>
  ACTION_META[a] || { label: a, cls: 'bg-gray-200 text-gray-600 dark:bg-[#3a3a38] dark:text-gray-300' }

// Решение владельца по блоку показываем НЕ отдельной записью, а строкой внутри
// карточки «Nový blok»: «завели → и что с ним стало» читается одним куском.
// Ключ склейки — entityDocId: движок пишет его и на создании блока, и на решении
// (booking-engine: block_create → created[0].documentId, block_approve/reject → blockDocId).
const APPROVAL_ACTIONS = new Set(['block_approve', 'block_reject'])
const PENDING_NOTE = 'čeká na schválení'

interface LogGroup {
  log: CalendarLog
  approval: CalendarLog | null
}

// rows приходят createdAt:desc → первое встреченное решение по блоку и есть последнее по времени.
// Склеиваем ТОЛЬКО пару create ↔ approve/reject: правка и удаление блока остаются
// отдельными записями, иначе действие спряталось бы внутри чужой карточки.
// Пара не сошлась (решение на соседней странице выдачи, серия с прошедшим первым днём —
// у неё владелец подтверждает не created[0]) → обе записи показываются как раньше.
const groupLogs = (rows: CalendarLog[]): LogGroup[] => {
  const latest = new Map<string, CalendarLog>()
  for (const r of rows) {
    if (APPROVAL_ACTIONS.has(r.action) && r.entityDocId && !latest.has(r.entityDocId)) {
      latest.set(r.entityDocId, r)
    }
  }
  const attached = new Map<string, CalendarLog>() // documentId создания → решение
  const consumed = new Set<string>() // documentId решений, ушедших внутрь карточки
  for (const r of rows) {
    if (r.action !== 'block_create' || !r.entityDocId) continue
    const a = latest.get(r.entityDocId)
    if (!a || consumed.has(a.documentId)) continue
    attached.set(r.documentId, a)
    consumed.add(a.documentId)
  }
  return rows
    .filter((r) => !consumed.has(r.documentId))
    .map((r) => ({ log: r, approval: attached.get(r.documentId) || null }))
}

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
  approval,
  open,
  onToggle,
  confirming,
  deleting,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  log: CalendarLog
  approval: CalendarLog | null
  open: boolean
  onToggle: () => void
  confirming: boolean
  deleting: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) => {
  const meta = actionMeta(log.action)
  const p = parseSummary(log.summary)
  // «čeká na schválení» приходит примечанием в summary — рисуем его цветным
  // статусом внизу карточки, а не серой строкой среди прочих примечаний
  const pending = log.action === 'block_create' && p.notes.includes(PENDING_NOTE)
  const notes = pending ? p.notes.filter((n) => n !== PENDING_NOTE) : p.notes
  // строку не удалось разложить (нестандартный формат) — показываем как есть
  const bare = !p.subject && !p.when && !p.changes.length && !p.notes.length
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white transition hover:border-gray-300 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:hover:border-[#4f4f4c]">
      <button type="button" onClick={onToggle} className="w-full pb-[10px] pl-3 pr-9 pt-[9px] text-left">
        {/* kdo: действие · администратор · когда записано */}
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
          <span className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-[#3a3a38] dark:text-[#b8b8b2]">
            {log.actorName || 'neznámý admin'}
          </span>
          <span
            className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500"
            title={fullTime(log.createdAt)}
          >
            {relTime(log.createdAt)}
          </span>
        </div>

        {/* koho se týká + kdy (термин прижат вправо, цифры моноширинные) */}
        {bare ? (
          <div className="mt-[7px] text-[15px] font-bold leading-5 text-gray-900 dark:text-[#f3f4f6]">
            {log.summary || '—'}
          </div>
        ) : (
          (p.subject || p.when) && (
            <div className="mt-[7px] flex items-baseline gap-2.5">
              {p.subject && (
                <span className="min-w-0 truncate text-[15px] font-bold leading-5 text-gray-900 dark:text-[#f3f4f6]">
                  {p.subject}
                </span>
              )}
              {p.when && (
                <span
                  className={`${p.subject ? 'ml-auto ' : ''}shrink-0 whitespace-nowrap text-[12px] font-semibold tabular-nums text-gray-500 dark:text-gray-400`}
                >
                  {p.when}
                </span>
              )}
            </div>
          )
        )}

        {/* co se změnilo: старое → новое */}
        {p.changes.map((ch) => (
          <div
            key={`${ch.from}→${ch.to}`}
            className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-gray-300 pl-[9px] dark:border-[#4a4a47]"
          >
            <span className="text-[13px] font-medium leading-[18px] text-gray-400 dark:text-[#8f8f8b]">{ch.from}</span>
            <span className="flex gap-1.5 text-[13px] font-semibold leading-[18px] text-gray-800 dark:text-[#e5e7eb]">
              <span className="shrink-0 text-gray-400 dark:text-gray-500">→</span>
              <span className="min-w-0">{ch.to}</span>
            </span>
          </div>
        ))}

        {notes.map((n) => (
          <div key={n} className="mt-[5px] text-[12px] font-medium leading-[17px] text-gray-500 dark:text-gray-400">
            {n}
          </div>
        ))}

        {/* stav bloku: решение владельца прямо в карточке заявки */}
        {approval ? (
          <div
            title={fullTime(approval.createdAt)}
            className={`mt-[7px] inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-[3px] text-[11px] font-semibold ${
              approval.action === 'block_approve'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
            }`}
          >
            <span className="shrink-0">{approval.action === 'block_approve' ? '✓' : '✕'}</span>
            <span className="truncate">
              {approval.action === 'block_approve' ? 'Schváleno' : 'Zamítnuto'}
              {approval.actorName ? ` · ${approval.actorName}` : ''} · {relTime(approval.createdAt)}
            </span>
          </div>
        ) : (
          pending && (
            <div className="mt-[7px] inline-flex max-w-full items-center gap-1.5 rounded bg-amber-100 px-1.5 py-[3px] text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <span className="shrink-0">⏳</span>
              <span className="truncate">Čeká na schválení</span>
            </div>
          )
        )}

        {open && <DetailBlock log={log} />}
      </button>

      {/* крестик — удаление записи журнала (только владелец видит сам модал) */}
      {!confirming && (
        <button
          type="button"
          onClick={onAskDelete}
          title="Smazat záznam z deníku"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[15px] leading-none text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          ✕
        </button>
      )}

      {confirming && (
        <div className="flex items-center justify-end gap-1.5 border-t border-gray-200 px-3 py-1.5 dark:border-[#3f3f3d]">
          <span className="mr-auto text-[11px] text-gray-500 dark:text-gray-400">
            {approval ? 'Smazat oba záznamy z deníku?' : 'Smazat záznam z deníku?'}
          </span>
          <button
            type="button"
            onClick={onCancelDelete}
            disabled={deleting}
            className="rounded px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-[#3a3a38]"
          >
            Ne
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={deleting}
            className="rounded bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? 'Mažu…' : 'Smazat'}
          </button>
        </div>
      )}
    </div>
  )
}

type EntityTab = 'all' | 'booking' | 'block' | 'client'

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
  // удаление записи журнала: подтверждение → процесс → ошибка
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [delError, setDelError] = useState<string | null>(null)
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

  // Крестик убирает карточку целиком: у склеенной пары это ДВЕ записи журнала
  // (заявка + решение) — иначе решение осталось бы висеть сиротой.
  // Если второе удаление не прошло — из списка уходит только реально удалённое.
  const handleDelete = useCallback(async (docIds: string[]) => {
    setDeletingId(docIds[0])
    setDelError(null)
    const done: string[] = []
    try {
      for (const id of docIds) {
        await deleteCalendarLog(id)
        done.push(id)
      }
      setConfirmId(null)
    } catch (e) {
      setDelError((e as Error).message)
    } finally {
      if (done.length) {
        setRows((prev) => prev.filter((r) => !done.includes(r.documentId)))
        setTotal((t) => Math.max(0, t - done.length))
      }
      setDeletingId(null)
    }
  }, [])

  // заявка на блок и решение владельца по нему — одна карточка
  const groups = useMemo(() => groupLogs(rows), [rows])

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
        {tabBtn('client', 'Klienti')}
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
        {delError && <p className="text-[12px] text-red-500">Smazání se nezdařilo: {delError}</p>}
        {!error && rows.length === 0 && !loading && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Žádné akce.</p>
        )}
        {groups.map(({ log, approval }) => (
          <LogRow
            key={log.documentId}
            log={log}
            approval={approval}
            open={open === log.documentId}
            onToggle={() => setOpen((cur) => (cur === log.documentId ? null : log.documentId))}
            confirming={confirmId === log.documentId}
            deleting={deletingId === log.documentId}
            onAskDelete={() => {
              setDelError(null)
              setConfirmId(log.documentId)
            }}
            onCancelDelete={() => setConfirmId(null)}
            onConfirmDelete={() =>
              handleDelete(approval ? [log.documentId, approval.documentId] : [log.documentId])
            }
          />
        ))}
        {loading && <p className="text-[12px] text-gray-400 dark:text-gray-500">Načítám…</p>}
        {!loading && page < pageCount && (
          <button
            type="button"
            onClick={() => load(page + 1, true)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-[9px] text-[14px] font-bold text-gray-600 hover:bg-gray-50 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
          >
            Načíst starší
          </button>
        )}
      </div>
    </ModalShell>
  )
}
