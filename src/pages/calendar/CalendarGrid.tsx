// Дневной грид календаря (как Noona): ось времени слева, колонки мастеров,
// затемнённое нерабочее время, карточки броней по позиции/длительности, линия now.

import { useMemo } from 'react'
import type { CalendarBooking, CalendarDay } from './fetch/calendarDay'
import { packColumn, nowMinPrague } from './fetch/calendarDay'

const PX_PER_MIN = 1.4 // высота минуты; 60 мин = 84px
const HEADER_H = 44 // высота шапки колонок
const AXIS_W = 56 // ширина оси времени

const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Цвет карточки по статусу
const cardStyle = (status: CalendarBooking['status']): { bg: string; border: string; text: string } => {
  switch (status) {
    case 'checkedOut':
      return { bg: '#dcfce7', border: '#4ade80', text: '#14532d' }
    case 'noshow':
      return { bg: '#fee2e2', border: '#f87171', text: '#7f1d1d' }
    case 'cancelled':
      return { bg: '#f1f5f9', border: '#cbd5e1', text: '#94a3b8' }
    default: // active
      return { bg: '#fce7f0', border: '#f9a8d4', text: '#831843' }
  }
}

interface Props {
  day: CalendarDay
  dateStr: string
  showCancelled: boolean
  onSelect: (b: CalendarBooking) => void
}

export const CalendarGrid = ({ day, dateStr, showCancelled, onSelect }: Props) => {
  const { openMin, closeMin, columns } = day
  const totalMin = Math.max(60, closeMin - openMin)
  const gridH = totalMin * PX_PER_MIN
  const nowMin = nowMinPrague(dateStr)

  // Часовые метки
  const hourLines = useMemo(() => {
    const lines: number[] = []
    for (let m = Math.ceil(openMin / 60) * 60; m <= closeMin; m += 60) lines.push(m)
    return lines
  }, [openMin, closeMin])

  const yOf = (min: number) => (min - openMin) * PX_PER_MIN

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <div className="flex" style={{ minWidth: AXIS_W + columns.length * 150 }}>
        {/* Ось времени */}
        <div className="shrink-0 border-r border-gray-200" style={{ width: AXIS_W }}>
          <div style={{ height: HEADER_H }} className="border-b border-gray-200" />
          <div className="relative" style={{ height: gridH }}>
            {hourLines.map((m) => (
              <div
                key={m}
                className="absolute right-1 -translate-y-1/2 text-[11px] font-medium text-gray-400"
                style={{ top: yOf(m) }}
              >
                {fmtHM(m)}
              </div>
            ))}
          </div>
        </div>

        {/* Колонки мастеров */}
        {columns.map((col) => {
          const positioned = packColumn(
            showCancelled ? col.bookings : col.bookings.filter((b) => b.status !== 'cancelled'),
          )
          return (
            <div key={col.id} className="shrink-0 border-r border-gray-200" style={{ width: 150 }}>
              {/* Шапка */}
              <div
                style={{ height: HEADER_H }}
                className="flex items-center justify-center gap-1 border-b border-gray-200 px-2 text-center"
              >
                <span className="truncate text-sm font-semibold text-gray-800">{col.name}</span>
                {col.id.startsWith('orphan:') && (
                  <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">bývalý</span>
                )}
              </div>

              {/* Тело колонки */}
              <div className="relative" style={{ height: gridH }}>
                {/* Часовые линии */}
                {hourLines.map((m) => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: yOf(m) }}
                  />
                ))}

                {/* Затемнённое нерабочее время (blocked_times) */}
                {col.blocks.map((bl, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 bg-gray-500/25"
                    style={{ top: yOf(bl.startMin), height: (bl.endMin - bl.startMin) * PX_PER_MIN }}
                    title="Nepracovní doba"
                  />
                ))}

                {/* Линия текущего времени */}
                {nowMin != null && nowMin >= openMin && nowMin <= closeMin && (
                  <div
                    className="absolute left-0 right-0 z-20 border-t-2 border-blue-500"
                    style={{ top: yOf(nowMin) }}
                  >
                    <span className="absolute -left-0 -top-2 h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}

                {/* Карточки броней */}
                {positioned.map((p) => {
                  const st = cardStyle(p.booking.status)
                  const laneW = 100 / p.lanes
                  const services = (p.booking.services || []).map((s) => s.title).filter(Boolean)
                  const dur = p.endMin - p.startMin
                  return (
                    <button
                      key={p.booking.documentId}
                      type="button"
                      onClick={() => onSelect(p.booking)}
                      className="absolute overflow-hidden rounded-md border px-1.5 py-1 text-left transition hover:brightness-95"
                      style={{
                        top: yOf(p.startMin) + 1,
                        height: Math.max(16, dur * PX_PER_MIN - 2),
                        left: `calc(${p.lane * laneW}% + 2px)`,
                        width: `calc(${laneW}% - 4px)`,
                        background: st.bg,
                        borderColor: st.border,
                        color: st.text,
                        zIndex: 10,
                      }}
                      title={`${fmtHM(p.startMin)}–${fmtHM(p.endMin)} · ${p.booking.clientNameRaw} · ${services.join(' + ')}`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {fmtHM(p.startMin)} · {p.booking.clientNameRaw || '—'}
                      </div>
                      {dur >= 40 && (
                        <div className="mt-0.5 truncate text-[10px] leading-tight opacity-80">
                          {services.join(' + ') || 'bez služby'}
                        </div>
                      )}
                      {dur >= 70 && p.booking.totalPrice != null && (
                        <div className="mt-0.5 text-[10px] font-semibold">{p.booking.totalPrice} Kč</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
