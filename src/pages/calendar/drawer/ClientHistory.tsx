// История клиента в шторке брони: строка истории и сам список.
//
// ⚠️ HistoryRow реэкспортируется из BookingDrawer: его импортирует оттуда
// ClientSearchModal — публичная поверхность распилом не меняется.
// Вынесено из calendar/BookingDrawer.tsx ДОСЛОВНО (этап 6 аудита).

import { fetchClientHistory, todayStrPrague } from '../fetch/calendarDay'
import type { CalendarBooking, ClientHistoryItem } from '../fetch/calendarDay'
import { STATUS_META } from '../utils'
import { useEffect, useState } from 'react'

export const HistoryRow = ({ r, onOpen }: { r: ClientHistoryItem; onOpen: (r: ClientHistoryItem) => void }) => {
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
      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left transition hover:border-gray-400 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:hover:border-[#5a5a56]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-300">{d}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-gray-900 dark:text-gray-300">{svc || 'bez služby'}</span>
        {r.employeeNameRaw && (
          <span className="shrink-0 text-[13px] font-semibold text-gray-900 dark:text-gray-300">{r.employeeNameRaw.split(' ')[0]}</span>
        )}
      </div>
    </button>
  )
}

// Секция «Historie klienta» в drawer — грузит брони клиента, делит на будущие/прошлые.
// restrictEmployeeId (роль master) → только брони ЭТОГО мастера с клиентом; визиты
// клиента к другим мастерам мастеру не показываются (и не запрашиваются).
// Мастеру сервер отдаёт только ЕГО визиты с этим клиентом — проп-ограничение
// здесь больше не нужно (и не было бы защитой: фильтр из query снимается).
export const ClientHistory = ({
  b,
  onOpen,
}: {
  b: CalendarBooking
  onOpen: (r: ClientHistoryItem) => void
}) => {
  const [history, setHistory] = useState<ClientHistoryItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setLoading(true)
    fetchClientHistory({
      clientDocId: b.client?.documentId,
      clientName: b.clientNameRaw,
    })
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
    <div className="mt-5 border-t border-gray-200 pt-3 dark:border-[#2e2e2c]">
      <div className="mb-2.5 text-sm font-bold text-gray-900 dark:text-gray-300">Historie klienta</div>
      {loading && <p className="text-[12px] text-gray-400 dark:text-gray-500">Načítám…</p>}
      {!loading && rows.length === 0 && <p className="text-[12px] text-gray-400 dark:text-gray-500">Žádné další rezervace.</p>}
      {future.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
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
        <div className={`rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2e2e2c] dark:bg-[#252523] ${future.length > 0 ? 'mt-2.5' : ''}`}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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

// Лейбл награды bitchcard: «Sleva 20 %» / «Sleva 400 Kč» уже в title — добавляем порог
