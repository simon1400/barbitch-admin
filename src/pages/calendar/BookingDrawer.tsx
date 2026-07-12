// Drawer с деталями брони: кнопки статусов (пишут в движок), кастомный лейбл,
// инлайн-подтверждение отмены с уведомлением, услуги (+ «Změnit službu»),
// секция «Historie klienta» (все брони клиента, клик → переход на её день).

import { useEffect, useState } from 'react'
import type { CalendarBooking, ClientHistoryItem } from './fetch/calendarDay'
import { fetchClientHistory, todayStrPrague } from './fetch/calendarDay'
import type { BookingLabel } from './fetch/bookingLabels'
import { STATUS_META, fmtTime } from './utils'

// Строка истории клиента (прошлая/будущая бронь) — клик открывает её день в календаре
const HistoryRow = ({ r, onOpen }: { r: ClientHistoryItem; onOpen: (r: ClientHistoryItem) => void }) => {
  const meta = STATUS_META[r.status] ?? STATUS_META.active
  const svc = (r.services || [])
    .map((s) => s.title)
    .filter(Boolean)
    .join(' + ')
  const d = `${r.date.split('-').reverse().slice(0, 2).join('. ')}.`
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left transition hover:border-gray-400"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-800">
          {d} · {fmtTime(r.startsAt)}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] text-gray-500">{svc || 'bez služby'}</span>
        {r.employeeNameRaw && (
          <span className="shrink-0 text-[12px] text-gray-400">{r.employeeNameRaw.split(' ')[0]}</span>
        )}
      </div>
    </button>
  )
}

// Секция «Historie klienta» в drawer — грузит все брони клиента, делит на будущие/прошлые
const ClientHistory = ({ b, onOpen }: { b: CalendarBooking; onOpen: (r: ClientHistoryItem) => void }) => {
  const [history, setHistory] = useState<ClientHistoryItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setLoading(true)
    fetchClientHistory({ clientDocId: b.client?.documentId, clientName: b.clientNameRaw })
      .then((rows) => {
        if (!cancelled) setHistory(rows.filter((r) => r.documentId !== b.documentId))
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [b.documentId, b.client?.documentId, b.clientNameRaw])

  const today = todayStrPrague()
  const rows = history || []
  const future = rows
    .filter((r) => r.date >= today)
    .sort((a, z) => (a.startsAt || '').localeCompare(z.startsAt || ''))
  const past = rows.filter((r) => r.date < today) // уже отсортированы desc

  return (
    <div className="mt-5 border-t border-gray-200 pt-3">
      <div className="mb-2.5 text-sm font-bold text-gray-900">Historie klienta</div>
      {loading && <p className="text-[12px] text-gray-400">Načítám…</p>}
      {!loading && rows.length === 0 && <p className="text-[12px] text-gray-400">Žádné další rezervace.</p>}
      {future.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            Budoucí rezervace ({future.length})
          </div>
          <div className="space-y-1.5">
            {future.map((r) => (
              <HistoryRow key={r.documentId} r={r} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div className={`rounded-lg border border-gray-200 bg-gray-50 p-2 ${future.length > 0 ? 'mt-2.5' : ''}`}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Proběhlé rezervace ({past.length})
          </div>
          <div className="space-y-1.5">
            {past.map((r) => (
              <HistoryRow key={r.documentId} r={r} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Drawer с деталями брони + кнопки статусов (пишут в движок)
export const BookingDrawer = ({
  b,
  labels,
  onClose,
  onStatus,
  onLabel,
  onManageLabels,
  onOpenHistory,
  onChangeService,
  busy,
}: {
  b: CalendarBooking
  labels: BookingLabel[]
  onClose: () => void
  onStatus: (status: CalendarBooking['status'], notify?: boolean) => void
  onLabel: (label: { name: string; color: string } | null) => void
  onManageLabels: () => void
  onOpenHistory: (r: ClientHistoryItem) => void
  onChangeService: () => void
  busy: boolean
}) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.active
  const hasEmail = Boolean((b.client?.email ?? '').trim())
  // инлайн-подтверждение отмены с чекбоксом «уведомить клиента» (роадмап §4.2)
  const [cancelling, setCancelling] = useState(false)
  const [notifyCancel, setNotifyCancel] = useState(hasEmail)
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-md font-bold text-gray-900">{b.clientNameRaw || '—'}</div>
            <div className="text-sm text-gray-500">
              {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm1">
            ✕
          </button>
        </div>

        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
          {meta.label}
        </span>

        {/* Кнопки статусов */}
        <div className="mt-3 flex flex-wrap gap-2">
          {b.status === 'active' ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('checkedOut')}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                ✓ Proběhla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('noshow')}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Nepřišla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Zrušit
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus('active')}
              className="rounded-md border border-pink-300 px-3 py-1.5 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-40"
            >
              ↩ Obnovit (aktivní)
            </button>
          )}
        </div>

        {/* Кастомный лейбл (только активные; прошедшие/отменённые получают авто-лейбл) */}
        {b.status === 'active' && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Štítek</span>
              <button type="button" onClick={onManageLabels} className="text-xs font-semibold text-primary hover:underline">
                Spravovat štítky
              </button>
            </div>
            {labels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const isSet = b.label?.name === l.name && b.label?.color === l.color
                  return (
                    <button
                      key={l.documentId}
                      type="button"
                      disabled={busy}
                      onClick={() => onLabel(isSet ? null : { name: l.name, color: l.color })}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                        isSet ? 'border-gray-700 bg-gray-100 text-gray-900' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                      {isSet && <span className="text-gray-400">✕</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Zatím žádné štítky — vytvořte je přes „Spravovat štítky“.</p>
            )}
          </div>
        )}

        {/* Инлайн-подтверждение отмены + чекбокс «уведомить клиента» */}
        {cancelling && b.status === 'active' && (
          <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-sm font-semibold text-red-800">
              Zrušit rezervaci {b.clientNameRaw}?
            </div>
            <label
              className={`flex items-center gap-2 text-sm ${hasEmail ? 'text-gray-700' : 'text-gray-400'}`}
            >
              <input
                type="checkbox"
                disabled={!hasEmail}
                checked={notifyCancel && hasEmail}
                onChange={(e) => setNotifyCancel(e.target.checked)}
              />
              Poslat klientovi e-mail o zrušení
              {!hasEmail && <span className="text-xs">(klient nemá e-mail)</span>}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('cancelled', notifyCancel && hasEmail)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Potvrdit zrušení
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Zpět
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Služby</span>
            {b.status === 'active' && (
              <button
                type="button"
                onClick={onChangeService}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Změnit službu
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(b.services || []).map((s, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-800">{s.title}</span>
                <span className="text-gray-500">
                   {s.durationMin ? `${s.durationMin} min` : ''} {/*{s.price != null ? `· ${s.price} Kč` : ''} */}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-500">Celkem</span>
          <span className="text-sm1 font-bold text-primary">
            {b.totalPrice != null ? `${b.totalPrice} Kč` : '—'}
          </span>
        </div>

        {(b.comment || b.customerComment) && (
          <div className="mt-4 space-y-2">
            {b.comment && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <b>Poznámka:</b> {b.comment}
              </div>
            )}
            {b.customerComment && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <b>Klient:</b> {b.customerComment}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400">
          {b.employeeNameRaw && <div>Mistr: {b.employeeNameRaw}</div>}
          {b.bsChannel && <div>Kanál: {b.bsChannel}</div>}
        </div>

        <ClientHistory b={b} onOpen={onOpenHistory} />

        <p className="mt-6 text-xs italic text-gray-400">
          Přesun rezervace: přetáhněte kartu v kalendáři na nový čas / k jinému mistrovi.
        </p>
      </div>
    </div>
  )
}
