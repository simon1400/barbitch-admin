// Дневной грид календаря: ось времени слева, колонки мастеров, затемнённое
// нерабочее время, карточки броней по позиции/длительности, линия now.
// Скроллится внутри собственной области: ось времени липнет слева, шапки мастеров —
// сверху (мобильный паттерн «замороженная строка+колонка»), свайп примагничивается
// к колонкам. Write-операции: drag-and-drop активных броней ТОЛЬКО мышью (на тач
// HTML5 DnD не работает — перенос через «Změnit termín» в drawer), клик по пустой
// клетке → новая бронь, клик по блоку → управление блоком.

import { useMemo, useRef, useState } from 'react'
import type { BlockedRange, CalendarBooking, CalendarDay, MasterColumn } from './fetch/calendarDay'
import { packColumn, nowMinPrague } from './fetch/calendarDay'
import { useCoarsePointer, useIsNarrow } from './useMediaQuery'
import { fmtHM } from './utils'
import { LogoIcon } from '../../icons/Logo'

const COL_W = 150 // ширина колонки (десктоп)
const COL_W_NARROW = 128 // ширина колонки на телефоне (видно ~2.5 мастера + ось)

const PX_PER_MIN = 1.0 // высота минуты; 60 мин = 60px (компактный масштаб как в Noona)
const PX_PER_MIN_NARROW = 1.4 // на телефоне крупнее — легче попасть пальцем в короткую бронь
const HEADER_H = 44 // высота шапки колонок
const AXIS_W = 56 // ширина оси времени
const SNAP_MIN = 30 // сетка клика/переноса — шаг резервации везде полчаса
const EXTRA_MIN = 120 // запас шкалы: ±2 часа до открытия и после закрытия (как в Noona)
const RIGHT_GUTTER_PCT = 10 // полоса справа от ВСЕХ карточек для клика/дозаписи на занятое время

// Цвет карточки: бренд красно-розовый для всех статусов (как в Noona), junior —
// фиолетовый. Статус различается ЛЕЙБЛОМ (закладка в углу), отменённые — полупрозрачные,
// noshow — полупрозрачные ЖЁЛТЫЕ (в тон их авто-лейбла «Nedostavil/a se» #f59e0b).
const cardStyle = (
  booking: CalendarBooking,
  tier?: 'senior' | 'junior',
): { bg: string; border: string; text: string; opacity: number } => {
  if (booking.status === 'noshow') {
    return { bg: '#f59e0b', border: '#d97706', text: '#ffffff', opacity: 0.45 }
  }
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
  // documentId брони, которую подсветить (мигание при переходе из истории клиента)
  highlightId?: string | null
  // множитель вертикального масштаба (кнопки зума на мобиле, как в Noona)
  zoomFactor?: number
  // клик по имени мастера в шапке → недельный вид этого мастера (только дневной режим)
  onSelectMaster?: (col: MasterColumn) => void
  // write-операции (не переданы → грид read-only)
  onEmptyCell?: (col: MasterColumn, startMin: number) => void
  onMoveBooking?: (b: CalendarBooking, target: MasterColumn, startMin: number) => void
  onSelectBlock?: (block: BlockedRange, col: MasterColumn) => void
}

export const CalendarGrid = ({ day, onSelect, highlightId, zoomFactor, onSelectMaster, onEmptyCell, onMoveBooking, onSelectBlock }: Props) => {
  const { openMin, closeMin, columns } = day
  // Адаптивный масштаб: телефон — уже колонки, крупнее минуты; тач — без HTML5 DnD
  const isNarrow = useIsNarrow()
  const coarse = useCoarsePointer()
  const pxPerMin = (isNarrow ? PX_PER_MIN_NARROW : PX_PER_MIN) * (zoomFactor || 1)
  const colW = isNarrow ? COL_W_NARROW : COL_W
  // Отображаемое окно шкалы = рабочий день ± EXTRA_MIN (в пределах суток);
  // зоны вне [openMin, closeMin] затеняются в каждой колонке
  const dispOpen = Math.max(0, openMin - EXTRA_MIN)
  const dispClose = Math.min(24 * 60, closeMin + EXTRA_MIN)
  const totalMin = Math.max(60, dispClose - dispOpen)
  const gridH = totalMin * pxPerMin
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

  const yOf = (min: number) => (min - dispOpen) * pxPerMin

  // Минута (снап 30) из вертикальной позиции события внутри тела колонки.
  // Клик: floor — курсор в клетке 10:00–10:30 целится в 10:00.
  const minuteOf = (e: React.MouseEvent | React.DragEvent, body: HTMLElement): number => {
    const rect = body.getBoundingClientRect()
    const raw = (e.clientY - rect.top) / pxPerMin + dispOpen
    return Math.max(0, Math.floor(raw / SNAP_MIN) * SNAP_MIN)
  }

  // Минута при drag: целимся ВЕРХНИМ краем перетаскиваемой карточки (точка захвата
  // вычитается), снап round — верхний край липнет к ближайшей получасовой линии
  const minuteOfDrag = (e: React.DragEvent, body: HTMLElement): number => {
    const rect = body.getBoundingClientRect()
    const raw = (e.clientY - dragOffsetY.current - rect.top) / pxPerMin + dispOpen
    return Math.max(0, Math.round(raw / SNAP_MIN) * SNAP_MIN)
  }

  return (
    // Скролл-контейнер (обе оси): sticky ось/шапки липнут к нему; snap-x —
    // горизонтальный свайп примагничивается к границам колонок
    <div className="h-full snap-x snap-proximity overflow-auto overscroll-contain rounded-xl bg-white shadow-sm">
      {/* pb на мобиле: нижняя пилюля даты не перекрывает последние слоты */}
      <div className="relative flex pb-16 sm:pb-0" style={{ minWidth: AXIS_W + columns.length * colW }}>
        {/* Вотермарка-лого по центру временно́й области грида (под шапкой): скроллится
            вместе с контентом, клики проходят сквозь; z-0 — ниже карточек (z-10),
            hover-подсветки (z-5) и sticky-оси/шапок (z-40/30) */}
        <div
          className="pointer-events-none absolute inset-x-0 z-0 flex select-none items-center justify-center"
          style={{ top: HEADER_H, height: gridH }}
          aria-hidden
        >
          <LogoIcon className="w-1/2 max-w-2xl fill-gray-900 opacity-[0.05]" />
        </div>
        {/* Ось времени — липнет слева при горизонтальном скролле; z выше шапок
            колонок, чтобы они уходили ПОД ось (не поверх) */}
        <div className="sticky left-0 z-40 shrink-0 border-r border-gray-200 bg-white" style={{ width: AXIS_W }}>
          {/* Угол (шапка оси) — липнет ещё и кверху */}
          <div style={{ height: HEADER_H }} className="sticky top-0 z-10 border-b border-gray-200 bg-white" />
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
            // flex-1 + minWidth: колонки растягиваются на всю ширину окна, на узком
            // экране — горизонтальный скролл; snap-start + scroll-ml (= AXIS_W) —
            // свайп примагничивает колонку к правому краю липкой оси
            <div
              key={col.id}
              className="min-w-0 flex-1 snap-start scroll-ml-14 border-r border-gray-200"
              style={{ minWidth: colW }}
            >
              {/* Шапка — липнет кверху при вертикальном скролле; у колонок-мастеров
                  кружок-аватар с инициалом (как в Noona; недельные колонки = дни, без него).
                  Клик по имени активного мастера → недельный вид этого мастера. */}
              {(() => {
                // кликабельно только для реальных активных мастеров (не бывшие, не дни)
                const clickable = Boolean(onSelectMaster) && !col.id.startsWith('orphan:') && !/^\d{4}-/.test(col.id)
                const HeaderTag = clickable ? 'button' : 'div'
                return (
                  <HeaderTag
                    type={clickable ? 'button' : undefined}
                    onClick={clickable ? () => onSelectMaster!(col) : undefined}
                    title={clickable ? `Týdenní přehled — ${col.name}` : undefined}
                    style={{ height: HEADER_H }}
                    className={`sticky top-0 z-30 flex w-full items-center justify-center gap-1.5 border-b border-gray-200 bg-white px-2 text-center ${
                      clickable ? 'cursor-pointer transition hover:bg-pink-50' : ''
                    }`}
                  >
                    {!/^\d{4}-/.test(col.id) && (
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{
                          background: col.id.startsWith('orphan:')
                            ? '#9ca3af'
                            : col.tier === 'junior'
                              ? '#a78bfa'
                              : '#f87184',
                        }}
                        aria-hidden
                      >
                        {(col.name.trim()[0] || '?').toUpperCase()}
                      </span>
                    )}
                    <span
                      className={`truncate text-sm font-semibold text-gray-800 ${clickable ? 'underline decoration-gray-300 decoration-dotted underline-offset-4' : ''}`}
                    >
                      {col.name.split(' ')[0]}
                    </span>
                    {col.id.startsWith('orphan:') && (
                      <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">bývalý</span>
                    )}
                  </HeaderTag>
                )
              })()}

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
                    style={{ top: yOf(hover.min), height: SNAP_MIN * pxPerMin }}
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
                    style={{ top: 0, height: (openMin - dispOpen) * pxPerMin }}
                  />
                )}
                {dispClose > closeMin && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-gray-400/15"
                    style={{ top: yOf(closeMin), height: (dispClose - closeMin) * pxPerMin }}
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
                    style={{ top: yOf(bl.startMin), height: (bl.endMin - bl.startMin) * pxPerMin }}
                    title={`${bl.title || 'Nepracovní doba'} (${fmtHM(bl.startMin)}–${fmtHM(bl.endMin)})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSelectBlock && bl.documentId) onSelectBlock(bl, col)
                    }}
                  >
                    <span className="pointer-events-none max-w-full p-2 absolute left-1.5 top-0.5 truncate text-sm font-bold text-gray-800">
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
                  // лейны делят не всю ширину, а без правой полосы (RIGHT_GUTTER_PCT):
                  // карточки не сжимаются, но справа всегда есть место кликнуть
                  const laneW = (100 - RIGHT_GUTTER_PCT) / p.lanes
                  const services = (p.booking.services || []).map((s) => s.title).filter(Boolean)
                  const dur = p.endMin - p.startMin
                  // на тач-устройстве HTML5 DnD не работает — перенос через «Změnit termín»
                  // в drawer; draggable оставляем только мыши (иначе long-press глючит)
                  const draggable = Boolean(onMoveBooking) && p.booking.status === 'active' && !coarse
                  const highlighted = highlightId === p.booking.documentId
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
                      } ${highlighted ? 'animate-pulse ring-4 ring-[#e71e6e] ring-offset-1' : ''}`}
                      style={{
                        top: yOf(p.startMin) + 1,
                        height: Math.max(isNarrow ? 22 : 16, dur * pxPerMin - 2),
                        left: `calc(${p.lane * laneW}% + 2px)`,
                        width: `calc(${laneW}% - 4px)`,
                        background: st.bg,
                        borderColor: st.border,
                        color: st.text,
                        opacity: st.opacity,
                        zIndex: highlighted ? 25 : 10,
                      }}
                      title={`${fmtHM(p.startMin)}–${fmtHM(p.endMin)} · ${p.booking.clientNameRaw} · ${services.join(' + ')}${label ? ` · ${label.name}` : ''}`}
                    >
                      {label && (
                        <span className="absolute right-1 top-0.5">
                          <LabelMark color={label.color} name={label.name} />
                        </span>
                      )}
                      <div className={`text-[13px] font-semibold leading-tight ${label ? 'pr-4' : ''}`}>
                        {fmtHM(p.startMin)} · {p.booking.clientNameRaw || '—'}
                      </div>
                      {dur >= 40 && (
                        <div className="mt-0.5 truncate text-[12px] leading-tight opacity-90">
                          {services.join(' + ') || 'bez služby'}
                        </div>
                      )}
                      {dur >= 70 && p.booking.totalPrice != null && (
                        <div className="mt-0.5 text-[12px] font-semibold">{p.booking.totalPrice} Kč</div>
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
