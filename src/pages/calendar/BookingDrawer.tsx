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
        <span className="text-[13px] font-semibold text-gray-800">{d}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-gray-900">{svc || 'bez služby'}</span>
        {r.employeeNameRaw && (
          <span className="shrink-0 text-[13px] font-semibold text-gray-900">{r.employeeNameRaw.split(' ')[0]}</span>
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

// Человеческие названия каналов Noona (bsChannel зеркальных броней)
const CHANNEL_LABELS: Record<string, string> = {
  bookingLink: 'web (rezervační odkaz)',
  calendar: 'Noona kalendář (ručně)',
  app: 'aplikace Noona',
  web: 'web noona.app',
  reserveWithGoogle: 'Google',
}

// «Кем/через что» создана бронь: движковые по origin (site/admin+имя админа),
// зеркальные Noona — по bsChannel (fallback сырой origin)
const bookingSourceLabel = (b: CalendarBooking): string | null => {
  if (b.origin === 'admin') return b.createdByName ? `kalendář — ${b.createdByName}` : 'kalendář (admin)'
  if (b.origin === 'site') return 'web barbitch.cz'
  const ch = b.bsChannel || b.origin
  return ch ? (CHANNEL_LABELS[ch] ?? ch) : null
}

// Момент создания брони: зеркальные несут noonaCreatedAt, движковые — createdAt
const bookingCreatedLabel = (b: CalendarBooking): string | null => {
  const iso = b.noonaCreatedAt || b.createdAt
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Drawer с деталями брони + кнопки статусов (пишут в движок).
// readOnly (роль master): чисто информационный вид — без кнопок статусов/переноса/
// смены услуги/лейблов/удаления; детали и история клиента остаются.
export const BookingDrawer = ({
  b,
  labels,
  onClose,
  onStatus,
  onLabel,
  onManageLabels,
  onOpenHistory,
  onChangeService,
  onReschedule,
  onDelete,
  busy,
  readOnly = false,
}: {
  b: CalendarBooking
  labels: BookingLabel[]
  onClose: () => void
  onStatus: (status: CalendarBooking['status'], notify?: boolean) => void
  onLabel: (label: { name: string; color: string } | null) => void
  onManageLabels: () => void
  onOpenHistory: (r: ClientHistoryItem) => void
  onChangeService: () => void
  onReschedule: () => void
  onDelete: () => void
  busy: boolean
  readOnly?: boolean
}) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.active
  const hasEmail = Boolean((b.client?.email ?? '').trim())
  // инлайн-подтверждение отмены с чекбоксом «уведомить клиента» (роадмап §4.2)
  const [cancelling, setCancelling] = useState(false)
  const [notifyCancel, setNotifyCancel] = useState(hasEmail)
  // инлайн-подтверждение ПОЛНОГО удаления брони (корзина — жёсткий delete, не отмена)
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Скроллящийся контент; кнопки статусов — фиксированный футер ниже */}
        <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-md font-bold text-gray-900">{b.clientNameRaw || '—'}</div>
            <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="-m-2 p-2 text-sm1 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        

        {/* Карточка «Kontakt» — телефон/e-mail клиента (админ должен уметь связаться).
            Мастерам (readOnly) НЕ показываем — контакты клиентов только для админов. */}
        {!readOnly && (
        <div className="mt-4 rounded-xl border border-gray-200 p-3">
          <div className="mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Kontakt
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm">
            {b.client?.phone ? (
              <a
                href={`tel:${b.client.phone}`}
                className="font-semibold text-gray-800 hover:text-primary"
              >
                📞 {b.client.phone}
              </a>
            ) : (
              <span className="text-gray-400">📞 telefon není uveden</span>
            )}
            {b.client?.email ? (
              <a
                href={`mailto:${b.client.email}`}
                className="break-all text-gray-800 hover:text-primary"
              >
                ✉️ {b.client.email}
              </a>
            ) : (
              <span className="text-gray-400">✉️ e-mail není uveden</span>
            )}
          </div>
        </div>
        )}

        {/* Карточка «Termín»: дата · время · мастер + кнопка переноса (дата/время/мастер) */}
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Termín</span>
            {b.status === 'active' && !readOnly && (
              <button
                type="button"
                onClick={onReschedule}
                className="rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 sm:px-2.5 sm:py-1"
              >
                Změnit termín
              </button>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 flex flex-col">
            <span>{b.date.split('-').reverse().join('. ')} | {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}</span>
            {b.employeeNameRaw && <span className="text-gray-500">{b.employeeNameRaw}</span>}
          </div>
        </div>

        {/* Карточка «Služby» — услуги + итоговая цена (Celkem относится к услугам) */}
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Služby</span>
            {b.status === 'active' && !readOnly && (
              <button
                type="button"
                onClick={onChangeService}
                className="rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 sm:px-2.5 sm:py-1"
              >
                Změnit službu
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(b.services || []).map((s, i) => (
              <div key={i} className="flex justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-800">{s.title}</span>
                <span className="text-gray-500 text-nowrap">
                   {s.durationMin ? `${s.durationMin} min` : ''} {/*{s.price != null ? `· ${s.price} Kč` : ''} */}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="text-sm font-semibold text-gray-700">Celkem</span>
            <span className="text-sm1 font-bold text-primary">
              {b.totalPrice != null ? `${b.totalPrice} Kč` : '—'}
            </span>
          </div>
        </div>

        {(b.comment || b.customerComment) && (
          <div className="mt-3 space-y-2">
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

        {/* Read-only (master): štítek показываем статично, без управления */}
        {readOnly && b.label && (
          <div className="mt-3 rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">Štítek</div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.label.color }} />
              {b.label.name}
            </span>
          </div>
        )}

        {/* Карточка «Štítek» (только активные; прошедшие/отменённые получают авто-лейбл) */}
        {b.status === 'active' && !readOnly && (
          <div className="mt-3 rounded-xl border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Štítek</span>
              <button type="button" onClick={onManageLabels} className="rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 sm:px-2.5 sm:py-1">
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
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:opacity-40 sm:px-2.5 sm:py-1 ${
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

        {/* Когда/кем/через что создана резервация (движок: site/admin+имя; зеркало: канал Noona) */}
        {(bookingCreatedLabel(b) || bookingSourceLabel(b)) && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-600">Vytvořeno:</span>{' '}
            {[bookingCreatedLabel(b), bookingSourceLabel(b)].filter(Boolean).join(' · ')}
          </div>
        )}

        <ClientHistory b={b} onOpen={onOpenHistory} />
        </div>

        {/* Фиксированный футер: кнопки статусов (+ инлайн-подтверждение отмены).
            pb с safe-area — кнопки не прячутся за жестовую полосу iPhone.
            readOnly (master) — футера нет вообще, drawer чисто информационный */}
        {!readOnly && (
        <div className="border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {deleting && (
            <div className="mb-3 space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
              <div className="text-sm font-semibold text-red-800">
                Smazat rezervaci {b.clientNameRaw} úplně?
              </div>
              <p className="text-xs text-red-700">
                Rezervace zmizí z kalendáře i historie klienta. Toto nelze vrátit zpět — pro běžné
                zrušení použijte „Zrušit“.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Smazat navždy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleting(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Zpět
                </button>
              </div>
            </div>
          )}
          {cancelling && b.status === 'active' && (
            <div className="mb-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
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
          <div className={'mb-2'}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus('checkedOut')}
              className="w-full text-nowrap rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 sm:py-2"
            >
              ✓ Proběhla
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {b.status === 'active' ? (
              <>
              
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatus('noshow')}
                  className="flex-1 rounded-md bg-red-600 px-3 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 sm:py-2"
                >
                  Nepřišla
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCancelling(true)
                    setDeleting(false)
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 sm:py-2"
                >
                  Zrušit
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('active')}
                className="flex-1 rounded-md border border-pink-300 px-3 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-40 sm:py-2"
              >
                ↩ Obnovit (aktivní)
              </button>
            )}
            {/* Корзина: полное удаление брони (с инлайн-подтверждением выше) */}
            <button
              type="button"
              disabled={busy}
              title="Smazat rezervaci úplně"
              onClick={() => {
                setDeleting(true)
                setCancelling(false)
              }}
              className="shrink-0 rounded-md border border-red-300 bg-white px-3.5 py-3 text-red-600 transition hover:bg-red-50 disabled:opacity-40 sm:px-2.5 sm:py-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
