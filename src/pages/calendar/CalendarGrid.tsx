// Дневной грид календаря: ось времени слева, колонки мастеров, затемнённое
// нерабочее время, карточки броней по позиции/длительности, линия now.
// Скроллится внутри собственной области: ось времени липнет слева, шапки мастеров —
// сверху (мобильный паттерн «замороженная строка+колонка»), свайп примагничивается
// к колонкам. Write-операции: перенос активных броней мышью (HTML5 DnD) и пальцем
// (удержание → перетаскивание, см. useTouchDrag), клик по пустой клетке → новая
// бронь, клик по блоку → управление блоком.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BlockedRange, CalendarBooking, CalendarDay, MasterColumn } from './fetch/calendarDay'
import { packColumn, nowMinPrague } from './fetch/calendarDay'
import { useCoarsePointer, useIsNarrow } from './useMediaQuery'
import { useTouchDrag } from './useTouchDrag'
import { fmtHM } from './utils'
import { LogoIcon } from '../../icons/Logo'

const COL_W = 150 // ширина колонки (десктоп)
const COL_W_NARROW = 128 // ширина колонки на телефоне (видно ~2.5 мастера + ось)

const PX_PER_MIN = 1.0 // высота минуты; 60 мин = 60px (компактный масштаб как в Noona)
// Телефон: базовый масштаб считается АДАПТИВНО — весь день влезает в высоту экрана
// (низ грида у нижней панели), zoomFactor умножается поверх. Эта константа — только
// фолбэк до первого замера контейнера.
const PX_PER_MIN_NARROW = 1.0
const MOBILE_BOTTOM_PAD = 64 // = pb-16 контента грида (клиренс нижней панели управления)
const HEADER_H = 44 // высота шапки колонок
const AXIS_W = 56 // ширина оси времени
const SNAP_MIN = 30 // сетка клика/переноса — шаг резервации везде полчаса
const EXTRA_MIN = 60 // запас шкалы: ±1 час до открытия и после закрытия (s121: было ±2ч, лишние пустые часы)
const RIGHT_GUTTER_PCT = 10 // полоса справа от ВСЕХ карточек для клика/дозаписи на занятое время
const OVERLAP_STEP_PCT = 10 // каскад пересекающихся карточек (как в Noona): нижняя выглядывает справа полоской этой ширины
const PHOTO_PREVIEW_DELAY_MS = 1000 // удержание ховера на аватарке до показа увеличенного фото
const EDGE_SCROLL_PX = 52 // зона у края грида, в которой перенос пальцем сам подкручивает скролл
const EDGE_SCROLL_STEP = 10 // px за тик автоскролла (~16мс)

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
      // active + arrived (клиент dorazil) → зелёный лейбл; иначе кастомный лейбл брони
      if (b.arrived) return { name: 'Dorazila', color: '#22c55e' }
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
  // процент мастера (режим master): на карточках показывается ЕГО доля, а не полная цена
  masterRate?: number | null
}

export const CalendarGrid = ({ day, onSelect, highlightId, zoomFactor, onSelectMaster, onEmptyCell, onMoveBooking, onSelectBlock, masterRate }: Props) => {
  const { openMin, closeMin, columns } = day
  // Адаптивный масштаб: телефон — уже колонки, крупнее минуты; тач — без HTML5 DnD
  const isNarrow = useIsNarrow()
  const coarse = useCoarsePointer()
  // Телефон: замеренный fit-масштаб (день целиком в экран); null до первого замера
  const [fitPx, setFitPx] = useState<number | null>(null)
  const pxPerMin = (isNarrow ? (fitPx ?? PX_PER_MIN_NARROW) : PX_PER_MIN) * (zoomFactor || 1)
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
  // карточка каскада, поднятая ховером на передний план (documentId брони)
  const [frontCardId, setFrontCardId] = useState<string | null>(null)
  // увеличенное фото мастера: ховер на аватарке в шапке ≥ PHOTO_PREVIEW_DELAY_MS
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null)
  const photoTimer = useRef<number | null>(null)
  const cancelPhotoPreview = useCallback(() => {
    if (photoTimer.current != null) {
      window.clearTimeout(photoTimer.current)
      photoTimer.current = null
    }
    setPhotoPreview(null)
  }, [])
  const schedulePhotoPreview = useCallback(
    (url: string, name: string) => {
      cancelPhotoPreview()
      photoTimer.current = window.setTimeout(() => setPhotoPreview({ url, name }), PHOTO_PREVIEW_DELAY_MS)
    },
    [cancelPhotoPreview],
  )
  useEffect(() => cancelPhotoPreview, [cancelPhotoPreview]) // чистка таймера на unmount
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

  // ── перенос пальцем (планшет): цель ищется по координатам, а не по событию дропа ──

  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  // откуда потащили — чтобы дроп в то же место не открывал окно подтверждения
  const dragSrc = useRef<{ colId: string; startMin: number } | null>(null)

  // Колонка + минута под пальцем. Колонку ищем через elementFromPoint (призрак и
  // подсветка pointer-events-none, карточки/блоки внутри тела → closest его найдёт)
  const resolvePoint = (x: number, y: number): { col: MasterColumn; min: number } | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const body = el?.closest('[data-col-body]') as HTMLElement | null
    const col = body?.dataset.colBody ? colById.get(body.dataset.colBody) : undefined
    if (!body || !col || !col.employeeDocId) return null // бывшие мастера (orphan) — read-only
    const rect = body.getBoundingClientRect()
    const raw = (y - dragOffsetY.current - rect.top) / pxPerMin + dispOpen
    return { col, min: Math.max(0, Math.round(raw / SNAP_MIN) * SNAP_MIN) }
  }
  // ref: автоскролл-таймер живёт дольше рендера и не должен звать устаревший резолвер
  const resolveRef = useRef(resolvePoint)
  resolveRef.current = resolvePoint

  const commitMove = (b: CalendarBooking, col: MasterColumn, min: number) => {
    const src = dragSrc.current
    dragSrc.current = null
    if (src && src.colId === col.id && src.startMin === min) return // не сдвинули — нечего подтверждать
    onMoveBooking?.(b, col, min)
  }

  // Автоскролл, когда палец у края: без него нельзя дотащить бронь к мастеру или
  // времени, которых сейчас не видно на экране
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Телефон (портрет): базовый масштаб = «весь день влезает по высоте» — низ грида
  // упирается в нижнюю панель управления, вертикального скролла по умолчанию нет.
  // Пере-замер при повороте/resize (ResizeObserver) и смене окна дня (totalMin).
  useLayoutEffect(() => {
    if (!isNarrow) return
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const free = el.clientHeight - HEADER_H - MOBILE_BOTTOM_PAD
      if (free > 120) setFitPx(Math.min(3, Math.max(0.3, free / totalMin)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isNarrow, totalMin])

  const edgeVec = useRef({ dx: 0, dy: 0 })
  const lastPt = useRef({ x: 0, y: 0 })
  const edgeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopEdgeScroll = useCallback(() => {
    if (edgeTimer.current) clearInterval(edgeTimer.current)
    edgeTimer.current = null
  }, [])
  useEffect(() => stopEdgeScroll, [stopEdgeScroll])

  const updateEdgeScroll = (x: number, y: number) => {
    const el = scrollRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = x < r.left + EDGE_SCROLL_PX ? -EDGE_SCROLL_STEP : x > r.right - EDGE_SCROLL_PX ? EDGE_SCROLL_STEP : 0
    // сверху отступаем ещё на шапку колонок — она липкая и перекрывает грид
    const dy =
      y < r.top + HEADER_H + EDGE_SCROLL_PX
        ? -EDGE_SCROLL_STEP
        : y > r.bottom - EDGE_SCROLL_PX
          ? EDGE_SCROLL_STEP
          : 0
    edgeVec.current = { dx, dy }
    if (!dx && !dy) {
      stopEdgeScroll()
      return
    }
    if (edgeTimer.current) return
    edgeTimer.current = setInterval(() => {
      scrollRef.current?.scrollBy(edgeVec.current.dx, edgeVec.current.dy)
      // грид уехал под неподвижным пальцем → цель поменялась, подсветку пересчитываем
      const t = resolveRef.current(lastPt.current.x, lastPt.current.y)
      if (t) setHoverSlot(t.col.id, t.min)
      else setHover(null)
    }, 16)
  }

  const touchDrag = useTouchDrag<CalendarBooking>({
    enabled: Boolean(onMoveBooking),
    onMove: (_b, x, y) => {
      lastPt.current = { x, y }
      const t = resolvePoint(x, y)
      if (t) setHoverSlot(t.col.id, t.min)
      else setHover(null)
      updateEdgeScroll(x, y)
    },
    onDrop: (b, x, y) => {
      stopEdgeScroll()
      setHover(null)
      const t = resolvePoint(x, y)
      if (t) commitMove(b, t.col, t.min)
      else dragSrc.current = null
    },
    onCancel: () => {
      stopEdgeScroll()
      setHover(null)
      dragSrc.current = null
    },
  })
  const touchDraggedId = touchDrag.active?.item.documentId

  return (
    // Скролл-контейнер (обе оси): sticky ось/шапки липнут к нему; snap-x —
    // горизонтальный свайп примагничивается к границам колонок
    <div
      ref={scrollRef}
      className="h-full snap-x snap-proximity overflow-auto overscroll-contain bg-white shadow-sm dark:bg-[#1c1c1b]"
    >
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
          {/* Вотермарка во всю ширину календаря: отступ по 15% слева/справа (w-70%),
              высота пропорционально (SVG сохраняет соотношение сторон) */}
          <LogoIcon className="w-[70%] fill-gray-900 opacity-[0.05] dark:fill-white dark:opacity-[0.06]" />
        </div>
        {/* Ось времени — липнет слева при горизонтальном скролле; z выше шапок
            колонок, чтобы они уходили ПОД ось (не поверх) */}
        <div
          className="sticky left-0 z-40 shrink-0 border-r border-gray-200 bg-white dark:border-[#2e2e2c] dark:bg-[#1c1c1b]"
          style={{ width: AXIS_W }}
        >
          {/* Угол (шапка оси) — липнет ещё и кверху */}
          <div
            style={{ height: HEADER_H }}
            className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-[#2e2e2c] dark:bg-[#1c1c1b]"
          />
          <div className="relative" style={{ height: gridH }}>
            {hourLines.map((m) => (
              <div
                key={m}
                className="absolute right-1 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-500"
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
              className="min-w-0 flex-1 snap-start scroll-ml-14 border-r border-gray-200 dark:border-[#2e2e2c]"
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
                    className={`sticky top-0 z-30 flex w-full items-center justify-center gap-1.5 border-b border-gray-200 bg-white px-2 text-center dark:border-[#2e2e2c] dark:bg-[#1c1c1b] ${
                      clickable ? 'cursor-pointer transition hover:bg-pink-50 dark:hover:bg-[#2a2226]' : ''
                    }`}
                  >
                    {!/^\d{4}-/.test(col.id) && (
                      <span
                        className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold text-white"
                        style={{
                          background: col.id.startsWith('orphan:')
                            ? '#9ca3af'
                            : col.tier === 'junior'
                              ? '#a78bfa'
                              : '#f87184',
                        }}
                        onMouseEnter={
                          col.photoUrl
                            ? () => schedulePhotoPreview(col.photoFullUrl || col.photoUrl!, col.name)
                            : undefined
                        }
                        onMouseLeave={col.photoUrl ? cancelPhotoPreview : undefined}
                        aria-hidden
                      >
                        {(col.name.trim()[0] || '?').toUpperCase()}
                        {/* Фото поверх инициала; нет/битое → виден инициал-фолбэк */}
                        {col.photoUrl && (
                          <img
                            src={col.photoUrl}
                            alt=""
                            loading="lazy"
                            draggable={false}
                            className="absolute inset-0 h-full w-full rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                      </span>
                    )}
                    <span
                      className={`truncate text-sm font-semibold text-gray-800 dark:text-gray-300 ${clickable ? 'underline decoration-gray-300 decoration-dotted underline-offset-4 dark:decoration-gray-600' : ''}`}
                    >
                      {col.name.split(' ')[0]}
                    </span>
                    {col.id.startsWith('orphan:') && (
                      <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500 dark:bg-[#2c2c2a] dark:text-gray-400">
                        bývalý
                      </span>
                    )}
                  </HeaderTag>
                )
              })()}

              {/* Тело колонки: клик по пустому месту = новая бронь, drop = перенос.
                  data-col-body — по нему перенос пальцем находит колонку под пальцем */}
              <div
                data-col-body={col.id}
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
                  commitMove(b, col, minuteOfDrag(e, e.currentTarget))
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
                    className="pointer-events-none absolute left-0 right-0 border-t border-gray-100 dark:border-[#262624]"
                    style={{ top: yOf(m) }}
                  />
                ))}

                {/* Зоны вне рабочего дня салона (запас ±2ч на шкале) */}
                {dispOpen < openMin && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-gray-400/15 dark:bg-black/30"
                    style={{ top: 0, height: (openMin - dispOpen) * pxPerMin }}
                  />
                )}
                {dispClose > closeMin && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-gray-400/15 dark:bg-black/30"
                    style={{ top: yOf(closeMin), height: (dispClose - closeMin) * pxPerMin }}
                  />
                )}

                {/* Затемнённое нерабочее время — клик открывает управление блоком */}
                {col.blocks.map((bl, i) => (
                  <div
                    key={bl.documentId || i}
                    role={onSelectBlock && bl.documentId ? 'button' : undefined}
                    className={`absolute left-0.5 right-0.5 rounded-md bg-gray-500/45 dark:bg-gray-300/20 ${
                      onSelectBlock && bl.documentId
                        ? 'cursor-pointer hover:bg-gray-500/55 dark:hover:bg-gray-300/30'
                        : 'pointer-events-none'
                    }`}
                    style={{ top: yOf(bl.startMin), height: (bl.endMin - bl.startMin) * pxPerMin }}
                    title={`${bl.title || 'Nepracovní doba'} (${fmtHM(bl.startMin)}–${fmtHM(bl.endMin)})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSelectBlock && bl.documentId) onSelectBlock(bl, col)
                    }}
                  >
                    <span className="pointer-events-none max-w-full p-2 absolute left-1.5 top-0.5 truncate text-sm font-bold text-gray-800 dark:text-gray-200">
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
                  // Noona-стиль каскада: РАННЯЯ бронь (lane 0) сверху и левее; каждая
                  // следующая в стеке сдвинута вправо на OVERLAP_STEP_PCT и лежит ПОД
                  // предыдущей, выглядывая справа полоской этой ширины (кликабельна).
                  // Ховер поднимает нижнюю карточку на передний план. Справа по-прежнему
                  // свободна полоса RIGHT_GUTTER_PCT для клика/дозаписи.
                  const usableW = 100 - RIGHT_GUTTER_PCT
                  // все карточки стека одной ширины (кламп ≥40%, чтобы оставались читаемы)
                  const cardW = Math.max(usableW - (p.lanes - 1) * OVERLAP_STEP_PCT, 40)
                  const leftPct = Math.min(p.lane * OVERLAP_STEP_PCT, usableW - cardW)
                  const stacked = p.lanes > 1
                  const services = (p.booking.services || []).filter((s) => s.title)
                  const serviceTitles = services.map((s) => s.title)
                  const dur = p.endMin - p.startMin
                  // Мышь — HTML5 DnD (на тач он мёртв). Палец — свой жест удержания
                  // (useTouchDrag), поэтому на тач-устройстве перенос тоже доступен.
                  const movable = Boolean(onMoveBooking) && p.booking.status === 'active'
                  const draggable = movable && !coarse
                  const highlighted = highlightId === p.booking.documentId
                  const lifted = touchDraggedId === p.booking.documentId // «поднята» пальцем
                  const isFront = stacked && frontCardId === p.booking.documentId
                  return (
                    <button
                      key={p.booking.documentId}
                      type="button"
                      draggable={draggable}
                      onMouseEnter={stacked ? () => setFrontCardId(p.booking.documentId) : undefined}
                      onMouseLeave={stacked ? () => setFrontCardId(null) : undefined}
                      onDragStart={(e) => {
                        dragged.current = p.booking
                        dragSrc.current = { colId: col.id, startMin: p.startMin }
                        // где внутри карточки схватили — чтобы drop целился её верхним краем
                        dragOffsetY.current = e.clientY - e.currentTarget.getBoundingClientRect().top
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        dragged.current = null
                      }}
                      onTouchStart={(e) => {
                        if (!movable) return
                        dragSrc.current = { colId: col.id, startMin: p.startMin }
                        dragOffsetY.current = e.touches[0].clientY - e.currentTarget.getBoundingClientRect().top
                        touchDrag.start(e, p.booking)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(p.booking)
                      }}
                      className={`absolute select-none overflow-hidden rounded-md border px-1.5 py-1 text-left transition [-webkit-touch-callout:none] hover:brightness-95 ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${highlighted ? 'animate-pulse ring-4 ring-[#e71e6e] ring-offset-1' : ''} ${
                        lifted ? 'ring-2 ring-[#e71e6e]' : ''
                      }`}
                      style={{
                        top: yOf(p.startMin) + 1,
                        // мин-высота (тач-цель) не больше высоты слота — при сильном зум-ауте
                        // короткие брони не должны наезжать на соседние
                        height: Math.max(
                          Math.min(isNarrow ? 22 : 16, Math.max(12, dur * pxPerMin)),
                          dur * pxPerMin - 2,
                        ),
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${cardW}% - 4px)`,
                        background: st.bg,
                        borderColor: st.border,
                        color: st.text,
                        // ховер в стеке делает карточку полностью непрозрачной (читаемость)
                        opacity: lifted ? 0.4 : isFront ? 1 : st.opacity,
                        // ранняя (lane 0) выше поздних; ховер поднимает на передний план;
                        // подсветка перехода из истории — выше всего
                        // 19..10: под линией now (z-20); ховер (24) — поверх неё
                        zIndex: highlighted ? 25 : isFront ? 24 : 19 - Math.min(p.lane, 9),
                        // тень у карточек стека — края каскада читаются друг на друге
                        boxShadow: stacked ? '2px 1px 6px rgba(0,0,0,0.3)' : undefined,
                      }}
                      title={`${fmtHM(p.startMin)}–${fmtHM(p.endMin)} · ${p.booking.clientNameRaw} · ${serviceTitles.join(' | ')}${label ? ` · ${label.name}` : ''}`}
                    >
                      {label && (
                        <span className="absolute right-1 top-0.5">
                          <LabelMark color={label.color} name={label.name} />
                        </span>
                      )}
                      <div className={`text-[13px] font-semibold leading-tight ${label ? 'pr-4' : ''}`}>
                        {fmtHM(p.startMin)} · {p.booking.clientNameRaw || '—'}
                      </div>
                      {dur >= 40 &&
                        (services.length > 1 ? (
                          // Мульти-услуга: каждая на своей строке через пунктирный
                          // разделитель (как в Noona) + её длительность
                          <div className="mt-0.5 text-[12px] leading-tight opacity-90">
                            {services.map((s, i) => (
                              <div
                                key={`${s.title}-${i}`}
                                className={`truncate ${i > 0 ? 'mt-1 pt-1' : ''}`}
                                style={i > 0 ? { borderTop: '1px dashed rgba(255,255,255,0.95)' } : undefined}
                              >
                                {s.title}
                                {s.durationMin ? ` (${s.durationMin}m)` : ''}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-0.5 truncate text-[12px] leading-tight opacity-90">
                            {serviceTitles[0] || 'bez služby'}
                          </div>
                        ))}
                      {dur >= 70 && p.booking.totalPrice != null && (
                        <div className="mt-0.5 text-[12px] font-semibold">
                          {masterRate != null
                            ? `${Math.round((p.booking.totalPrice * masterRate) / 100)} Kč`
                            : `${p.booking.totalPrice} Kč`}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {/* Призрак под пальцем: показывает, ЧТО тащим и куда попадём (время = подсвеченный
          слот). fixed → не зависит от скролла грида; pointer-events-none → не мешает
          elementFromPoint искать колонку под пальцем */}
      {touchDrag.active && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[12px] font-bold text-white shadow-lg"
          style={{ left: touchDrag.active.x, top: touchDrag.active.y, transform: 'translate(-50%, -170%)' }}
        >
          {hover ? `${fmtHM(hover.min)} · ` : ''}
          {touchDrag.active.item.clientNameRaw || 'Rezervace'}
        </div>
      )}
      {/* Увеличенное фото мастера (ховер на аватарке ≥1с). pointer-events-none —
          закрывается само уходом мыши с аватарки, кликов не перехватывает */}
      {photoPreview && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl dark:bg-[#252523]">
            <img
              src={photoPreview.url}
              alt={photoPreview.name}
              className="h-72 w-72 rounded-xl object-cover"
            />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{photoPreview.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}
