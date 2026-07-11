// Календарь администраторов — ЧЕРНОВОЙ каркас (фаза 2 own-booking, s99).
// Read-only список дня по мастерам из локального зеркала Noona (booking).
// Полноценный дневной грид (сетка 15 мин, drag-and-drop) — следующие сессии.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container } from '../../components/Container'
import type { CalendarBooking } from './fetch/calendarDay'
import { fetchCalendarDay, groupByMaster, type MasterColumn } from './fetch/calendarDay'

const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const shiftDate = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    : '—'

const STATUS_META: Record<CalendarBooking['status'], { label: string; cls: string }> = {
  active: { label: 'aktivní', cls: 'bg-pink-100 text-pink-700' },
  checkedOut: { label: '✓ proběhla', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'zrušena', cls: 'bg-gray-200 text-gray-500' },
  noshow: { label: 'nepřišla', cls: 'bg-red-100 text-red-700' },
}

const BookingRow = ({ b }: { b: CalendarBooking }) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.active
  const services = (b.services || []).map((s) => s.title).filter(Boolean)
  return (
    <div className={`rounded-lg border border-gray-200 bg-white px-3 py-2 ${b.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-0.5 text-sm text-gray-800">{b.clientNameRaw || '—'}</div>
      <div className="mt-0.5 text-xs text-gray-500">
        {services.length ? services.join(' · ') : 'bez služby'}
        {b.totalPrice != null && <span className="ml-2 font-semibold text-primary">{b.totalPrice} Kč</span>}
      </div>
      {(b.comment || b.customerComment) && (
        <div className="mt-1 text-xs italic text-gray-400">
          {[b.comment, b.customerComment].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}

const MasterSection = ({ col, showCancelled }: { col: MasterColumn; showCancelled: boolean }) => {
  const visible = showCancelled ? col.bookings : col.bookings.filter((b) => b.status !== 'cancelled')
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">
          {col.name}
          {!col.isActiveMaster && (
            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
              bývalý
            </span>
          )}
        </h3>
        <span className="text-xs text-gray-500">{visible.length} rez.</span>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-gray-400">Žádné rezervace</p>
      ) : (
        <div className="space-y-2">
          {visible.map((b) => (
            <BookingRow key={b.documentId} b={b} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const [date, setDate] = useState(todayStr())
  const [columns, setColumns] = useState<MasterColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const load = useCallback(async (dateStr: string) => {
    setLoading(true)
    setError(null)
    try {
      const day = await fetchCalendarDay(dateStr)
      setColumns(groupByMaster(day))
    } catch (e) {
      setError((e as Error).message || 'Nepodařilo se načíst den')
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  const totals = useMemo(() => {
    const all = columns.flatMap((c) => c.bookings)
    return {
      total: all.filter((b) => b.status !== 'cancelled').length,
      cancelled: all.filter((b) => b.status === 'cancelled').length,
    }
  }, [columns])

  return (
    <Container size="xl" className="py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-4 text-2xl font-bold text-gray-900">Kalendář</h2>
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, -1))}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          ◀
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setDate(todayStr())}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          Dnes
        </button>
        <label className="ml-2 flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          zrušené ({totals.cancelled})
        </label>
        <span className="ml-auto text-sm text-gray-600">
          Celkem: <b>{totals.total}</b> rezervací
        </span>
      </div>

      <p className="mb-4 text-xs text-gray-400">
        Náhled ze zrcadla Noona (read-only, sync každých 10 min) — akce zatím provádějte v Noona.
      </p>

      {loading && <p className="text-sm text-gray-500">Načítám…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columns
            .filter((c) => c.isActiveMaster || c.bookings.length > 0)
            .map((col) => (
              <MasterSection key={col.key} col={col} showCancelled={showCancelled} />
            ))}
        </div>
      )}
    </Container>
  )
}
