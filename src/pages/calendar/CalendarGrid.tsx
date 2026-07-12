// Дневной грид календаря: ось времени слева, колонки мастеров, затемнённое
// нерабочее время, карточки броней по позиции/длительности, линия now.
// Write-операции: drag-and-drop активных броней (снап 15 мин), клик по пустой
// клетке → новая бронь, ✕ на own-блоках движка (зеркальные Noona-блоки read-only).

import { useMemo, useRef, useState } from 'react'
import type { BlockedRange, CalendarBooking, CalendarDay, MasterColumn } from './fetch/calendarDay'
import { packColumn, nowMinPrague } from './fetch/calendarDay'

const COL_W = 150 // ширина колонки

const PX_PER_MIN = 1.0 // высота минуты; 60 мин = 60px (компактный масштаб как в Noona)
const HEADER_H = 44 // высота шапки колонок
const AXIS_W = 56 // ширина оси времени
const SNAP_MIN = 30 // сетка клика/переноса — шаг резервации везде полчаса
const EXTRA_MIN = 120 // запас шкалы: ±2 часа до открытия и после закрытия (как в Noona)

const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Цвет карточки: бренд красно-розовый для всех статусов (как в Noona), junior —
// фиолетовый. Статус различается ЛЕЙБЛОМ (закладка в углу), отменённые — полупрозрачные.
const cardStyle = (
  booking: CalendarBooking,
  tier?: 'senior' | 'junior',
): { bg: string; border: string; text: string; opacity: number } => {
  const base =
    tier === 'junior'
      ? { bg: '#a78bfa', border: '#8b5cf6', text: '#ffffff' } // junior — фиолетовый
      : { bg: '#f87184', border: '#ee5c72', text: '#ffffff' } // бренд красно-розовый
  return { ...base, opacity: booking.status === 'cancelled' ? 0.45 : 1 }
}

// Авто-лейбл по статусу (как stavy в Noona); active → кастомный лейбл брони (если задан)
const bookingLabel = (b: CalendarBooking): { name: string; color: string } | null => {
  switch (b.status) {
    case 'checkedOut':
      return { name: 'Zpracováno', color: '#3b82f6' }
    case 'cancelled':
      return { name: 'Zrušeno', color: '#ef4444' }
    case 'noshow':
      return { name: 'Nedostavil/a se', color: '#f59e0b' }
    default:
      return b.label?.name && b.label?.color ? { name: b.label.name, color: b.label.color } : null
  }
}

// Закладка-лейбл (bookmark, как в Noona)
const LabelMark = ({ color, name }: { color: string; name: string }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3 shrink-0 drop-shadow-sm"
    fill={color}
    aria-label={name}
  >
    <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z" />
  </svg>
)

interface Props {
  day: CalendarDay
  onSelect: (b: CalendarBooking) => void
  // write-операции (не переданы → грид read-only)
  onEmptyCell?: (col: MasterColumn, startMin: number) => void
  onMoveBooking?: (b: CalendarBooking, target: MasterColumn, startMin: number) => void
  onSelectBlock?: (block: BlockedRange, col: MasterColumn) => void
}

export const CalendarGrid = ({ day, onSelect, onEmptyCell, onMoveBooking, onSelectBlock }: Props) => {
  const { openMin, closeMin, columns } = day
  // Отображаемое окно шкалы = рабочий день ± EXTRA_MIN (в пределах суток);
  // зоны вне [openMin, closeMin] затеняются в каждой колонке
  const dispOpen = Math.max(0, openMin - EXTRA_MIN)
  const dispClose = Math.min(24 * 60, closeMin + EXTRA_MIN)
  const totalMin = Math.max(60, dispClose - dispOpen)
  const gridH = totalMin * PX_PER_MIN
  const nowMin = nowMinPrague()
  // Перетаскиваемая бронь (ref, не state — рендер не нужен)
  const dragged = useRef<CalendarBooking | null>(null)
  // Смещение точки захвата от ВЕРХА карточки (px) — перенос целится верхним краем, не курсором
  const dragOffsetY = useRef(0)
  // Подсветка получасового слота под курсором (куда попадёт клик/дроп)
  const [hover, setHover] = useState<{ colId: string; min: number } | null>(null)
  const setHoverSlot = (colId: string, min: number) =>
    setHover((prev) => (prev && prev.colId === colId && prev.min === min ? prev : { colId, min }))
  const clearHover = (colId: string) => setHover((prev) => (prev?.colId === colId ? null : prev))

  // Часовые метки (по всей отображаемой шкале, включая запас ±2ч).
  // Крайние (= dispOpen / dispClose) не рендерим: метка по краю выступает за грид
  // (-translate-y-1/2) и через overflow-x-auto порождала вертикальный скроллбар
  const hourLines = useMemo(() => {
    const lines: number[] = []
    for (let m = Math.ceil(dispOpen / 60) * 60; m <= dispClose; m += 60) {
      if (m === dispOpen || m === dispClose) continue
      lines.push(m)
    }
    return lines
  }, [dispOpen, dispClose])

  const yOf = (min: number) => (min - dispOpen) * PX_PER_MIN

  // Минута (снап 30) из вертикальной позиции события внутри тела колонки.
  // Клик: floor — курсор в клетке 10:00–10:30 целится в 10:00.
  const minuteOf = (e: React.MouseEvent | React.DragEvent, body: HTMLElement): number => {
    const rect = body.getBoundingClientRect()
    const raw = (e.clientY - rect.top) / PX_PER_MIN + dispOpen
    return Math.max(0, Math.floor(raw / SNAP_MIN) * SNAP_MIN)
  }

  // Минута при drag: целимся ВЕРХНИМ краем перетаскиваемой карточки (точка захвата
  // вычитается), снап round — верхний край липнет к ближайшей получасовой линии
  const minuteOfDrag = (e: React.DragEvent, body: HTMLElement): number => {
    const rect = body.getBoundingClientRect()
    const raw = (e.clientY - dragOffsetY.current - rect.top) / PX_PER_MIN + dispOpen
    return Math.max(0, Math.round(raw / SNAP_MIN) * SNAP_MIN)
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <div className="flex" style={{ minWidth: AXIS_W + columns.length * COL_W }}>
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
          // отменённые показываются всегда (полупрозрачные, с красным лейблом)
          const positioned = packColumn(col.bookings)
          const writable = Boolean(col.employeeDocId)
          return (
            // flex-1 + minWidth: колонки растягиваются на всю ширину окна, на узком экране — горизонтальный скролл
            <div key={col.id} className="min-w-0 flex-1 border-r border-gray-200" style={{ minWidth: COL_W }}>
              {/* Шапка */}
              <div
                style={{ height: HEADER_H }}
                className="flex items-center justify-center gap-1 border-b border-gray-200 px-2 text-center"
              >
                <span className="truncate text-sm font-semibold text-gray-800">{col.name.split(' ')[0]}</span>
                {col.id.startsWith('orphan:') && (
                  <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">bývalý</span>
                )}
              </div>

              {/* Тело колонки: клик по пустому месту = новая бронь, drop = перенос */}
              <div
                className={`relative ${writable && onEmptyCell ? 'cursor-pointer' : ''}`}
                style={{ height: gridH }}
                onClick={(e) => {
                  if (!writable || !onEmptyCell) return
                  if (e.target !== e.currentTarget) return // карточки/блоки гасят сами
                  onEmptyCell(col, minuteOf(e, e.currentTarget))
                }}
                onMouseMove={(e) => {
                  if (!writable || !onEmptyCell) return
                  // над карточкой/блоком подсветку не показываем (клик туда не создаёт бронь)
                  if (e.target !== e.currentTarget) {
                    clearHover(col.id)
                    return
                  }
                  setHoverSlot(col.id, minuteOf(e, e.currentTarget))
                }}
                onMouseLeave={() => clearHover(col.id)}
                onDragOver={(e) => {
                  if (!writable || !dragged.current) return
                  e.preventDefault()
                  setHoverSlot(col.id, minuteOfDrag(e, e.currentTarget))
                }}
                onDragLeave={() => clearHover(col.id)}
                onDrop={(e) => {
                  if (!writable || !onMoveBooking || !dragged.current) return
                  e.preventDefault()
                  clearHover(col.id)
                  const b = dragged.current
                  dragged.current = null
                  onMoveBooking(b, col, minuteOfDrag(e, e.currentTarget))
                }}
              >
                {/* Подсветка слота под курсором */}
                {hover?.colId === col.id && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-[5] flex items-center justify-center bg-[#e71e6e40]"
                    style={{ top: yOf(hover.min), height: SNAP_MIN * PX_PER_MIN }}
                  >
                    <span className="absolute left-1 top-0.5 rounded bg-primary px-1 text-[10px] font-bold text-white">
                      {fmtHM(hover.min)}
                    </span>
                    <span className="text-[18px] font-normal leading-none text-primary">+</span>
                  </div>
                )}
                {/* Часовые линии */}
                {hourLines.map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: yOf(m) }}
                  />
                ))}

                {/* Зоны вне рабочего дня салона (запас ±2ч на шкале) */}
                {dispOpen < openMin && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-gray-400/15"
                    style={{ top: 0, height: (openMin - dispOpen) * PX_PER_MIN }}
                  />
                )}
                {dispClose > closeMin && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-gray-400/15"
                    style={{ top: yOf(closeMin), height: (dispClose - closeMin) * PX_PER_MIN }}
                  />
                )}

                {/* Затемнённое нерабочее время — клик открывает управление блоком */}
                {col.blocks.map((bl, i) => (
                  <div
                    key={bl.documentId || i}
                    role={onSelectBlock && bl.documentId ? 'button' : undefined}
                    className={`absolute left-0.5 right-0.5 rounded-md bg-gray-500/45 ${
                      onSelectBlock && bl.documentId ? 'cursor-pointer hover:bg-gray-500/55' : 'pointer-events-none'
                    }`}
                    style={{ top: yOf(bl.startMin), height: (bl.endMin - bl.startMin) * PX_PER_MIN }}
                    title={`${bl.title || 'Nepracovní doba'} (${fmtHM(bl.startMin)}–${fmtHM(bl.endMin)})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSelectBlock && bl.documentId) onSelectBlock(bl, col)
                    }}
                  >
                    <span className="pointer-events-none absolute left-1.5 top-0.5 truncate text-[10px] font-medium text-gray-800">
                      {bl.title || (bl.own ? 'blok' : 'Nepracovní doba')}
                    </span>
                  </div>
                ))}

                {/* Линия текущего времени — только в колонке «сегодня» */}
                {col.showNow && nowMin != null && nowMin >= dispOpen && nowMin <= dispClose && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-blue-500"
                    style={{ top: yOf(nowMin) }}
                  >
                    <span className="absolute -left-0 -top-2 h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}

                {/* Карточки броней (активные — draggable) */}
                {positioned.map((p) => {
                  const st = cardStyle(p.booking, col.tier)
                  const label = bookingLabel(p.booking)
                  const laneW = 100 / p.lanes
                  const services = (p.booking.services || []).map((s) => s.title).filter(Boolean)
                  const dur = p.endMin - p.startMin
                  const draggable = Boolean(onMoveBooking) && p.booking.status === 'active'
                  return (
                    <button
                      key={p.booking.documentId}
                      type="button"
                      draggable={draggable}
                      onDragStart={(e) => {
                        dragged.current = p.booking
                        // где внутри карточки схватили — чтобы drop целился её верхним краем
                        dragOffsetY.current = e.clientY - e.currentTarget.getBoundingClientRect().top
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        dragged.current = null
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(p.booking)
                      }}
                      className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-left transition hover:brightness-95 ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      style={{
                        top: yOf(p.startMin) + 1,
                        height: Math.max(16, dur * PX_PER_MIN - 2),
                        left: `calc(${p.lane * laneW}% + 2px)`,
                        width: `calc(${laneW}% - 4px)`,
                        background: st.bg,
                        borderColor: st.border,
                        color: st.text,
                        opacity: st.opacity,
                        zIndex: 10,
                      }}
                      title={`${fmtHM(p.startMin)}–${fmtHM(p.endMin)} · ${p.booking.clientNameRaw} · ${services.join(' + ')}${label ? ` · ${label.name}` : ''}`}
                    >
                      {label && (
                        <span className="absolute right-1 top-0.5">
                          <LabelMark color={label.color} name={label.name} />
                        </span>
                      )}
                      <div className={`text-[11px] font-semibold leading-tight ${label ? 'pr-4' : ''}`}>
                        {fmtHM(p.startMin)} · {p.booking.clientNameRaw || '—'}
                      </div>
                      {dur >= 40 && (
                        <div className="mt-0.5 truncate text-[10px] leading-tight opacity-90">
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
