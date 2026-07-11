// Календарь администраторов (фаза 2 own-booking, s99).
// Дневной грид как в Noona: колонки мастеров, ось времени, нерабочее время,
// карточки броней по позиции/длительности, линия now. Read-only из зеркала.
// Write-действия (перенос/статусы) — фаза 3.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container } from '../../components/Container'
import type { CalendarBooking, CalendarDay } from './fetch/calendarDay'
import { fetchCalendarDay } from './fetch/calendarDay'
import { CalendarGrid } from './CalendarGrid'

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
  iso ? new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '—'

const STATUS_META: Record<CalendarBooking['status'], { label: string; cls: string }> = {
  active: { label: 'aktivní', cls: 'bg-pink-100 text-pink-700' },
  checkedOut: { label: '✓ proběhla', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'zrušena', cls: 'bg-gray-200 text-gray-500' },
  noshow: { label: 'nepřišla', cls: 'bg-red-100 text-red-700' },
}

// Drawer с деталями брони
const BookingDrawer = ({ b, onClose }: { b: CalendarBooking; onClose: () => void }) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.active
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">{b.clientNameRaw || '—'}</div>
            <div className="text-sm text-gray-500">
              {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
          {meta.label}
        </span>

        <div className="mt-4 space-y-2">
          {(b.services || []).map((s, i) => (
            <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-800">{s.title}</span>
              <span className="text-gray-500">
                {s.durationMin ? `${s.durationMin} min` : ''} {s.price != null ? `· ${s.price} Kč` : ''}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-500">Celkem</span>
          <span className="text-lg font-bold text-primary">
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

        <p className="mt-6 text-xs italic text-gray-400">
          Read-only náhled ze zrcadla Noona. Úpravy zatím v Noona (write — фаза 3).
        </p>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState<CalendarDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [selected, setSelected] = useState<CalendarBooking | null>(null)

  const load = useCallback(async (dateStr: string) => {
    setLoading(true)
    setError(null)
    try {
      setDay(await fetchCalendarDay(dateStr))
    } catch (e) {
      setError((e as Error).message || 'Nepodařilo se načíst den')
      setDay(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  const totals = useMemo(() => {
    if (!day) return { total: 0, cancelled: 0 }
    const all = day.columns.flatMap((c) => c.bookings)
    return {
      total: all.filter((b) => b.status !== 'cancelled').length,
      cancelled: all.filter((b) => b.status === 'cancelled').length,
    }
  }, [day])

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
        Náhled ze zrcadla Noona (read-only, sync každých 10 min). Pracovní hodiny a nepracovní doba
        živě z Noona. Akce zatím provádějte v Noona.
      </p>

      {loading && <p className="text-sm text-gray-500">Načítám…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && day && (
        <CalendarGrid day={day} dateStr={date} showCancelled={showCancelled} onSelect={setSelected} />
      )}

      {selected && <BookingDrawer b={selected} onClose={() => setSelected(null)} />}
    </Container>
  )
}
