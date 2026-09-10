// Дневной грид календаря: ось времени слева, колонки мастеров, затемнённое
// нерабочее время, карточки броней по позиции/длительности, линия now.
// Скроллится внутри собственной области: ось времени липнет слева, шапки мастеров —
// сверху (мобильный паттерн «замороженная строка+колонка»), свайп примагничивается
// к колонкам. Write-операции: перенос активных броней мышью (HTML5 DnD) и пальцем
// (удержание → перетаскивание, см. useTouchDrag), клик по пустой клетке → новая
// бронь, клик по блоку → управление блоком.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CalendarBooking, MasterColumn } from './fetch/calendarDay'
import { packColumn, nowMinPrague } from './fetch/calendarDay'
import { createLiveValue } from './liveValue'
import { masterShare } from './pricing'
import { useCoarsePointer, useIsNarrow } from './useMediaQuery'
import { useTouchDrag } from './useTouchDrag'
import { fmtHM } from './utils'
import { LogoIcon } from '../../icons/Logo'
import { AXIS_W, COL_W, COL_W_NARROW, EDGE_SCROLL_PX, EDGE_SCROLL_STEP, EXTRA_MIN, HEADER_H, MOBILE_BOTTOM_PAD, OVERLAP_STEP_PCT, PX_PER_MIN, PX_PER_MIN_NARROW, RIGHT_GUTTER_PCT, SNAP_MIN, bookingLabel, cardStyle, type HoverSlot } from './grid/geometry'
import { LabelMark, SlotHighlight, TouchGhost } from './grid/parts'
import type { CalendarGridProps } from './grid/props'

export const CalendarGrid = ({ day, onSelect, highlightId, zoomFactor, onSelectMaster, onEmptyCell, onMoveBooking, onSelectBlock, masterRate, priceEmployeeId = null }: CalendarGridProps) => {
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
  // Линия текущего времени. Раньше `nowMinPrague()` (внутри — Intl.formatToParts)
  // вызывался в теле рендера, то есть на каждое движение мыши по гриду, а сама
  // линия при этом двигалась только тогда, когда грид случайно перерисовывался.
  // Теперь — свой тик раз в минуту: и работы меньше, и линия едет предсказуемо.
  const [nowMin, setNowMin] = useState<number | null>(() => nowMinPrague())
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinPrague()), 60000)
    return () => clearInterval(t)
  }, [])
  // Перетаскиваемая бронь (ref, не state — рендер не нужен)
  const dragged = useRef<CalendarBooking | null>(null)
  // Смещение точки захвата от ВЕРХА карточки (px) — перенос целится верхним краем, не курсором
  const dragOffsetY = useRef(0)
  // Подсветка получасового слота под курсором (куда попадёт клик/дроп).
  // Живёт ВНЕ состояния грида: меняется на каждом пересечении получасовой границы
  // (и на каждом touchmove при переносе), а рисует её один прямоугольник — см. liveValue.
  const [hoverLive] = useState(() =>
    createLiveValue<HoverSlot>(null, (a, b) =>
      a === b || Boolean(a && b && a.colId === b.colId && a.min === b.min),
    ),
  )
  // карточка каскада, поднятая ховером на передний план (documentId брони)
  const [frontCardId, setFrontCardId] = useState<string | null>(null)
  const setHoverSlot = (colId: string, min: number) => hoverLive.set({ colId, min })
  const clearHover = (colId: string) => {
    if (hoverLive.get()?.colId === colId) hoverLive.set(null)
  }

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
  // Лейн-паковка пересекающихся броней. Считалась в теле рендера для КАЖДОЙ колонки,
  // а внутри `isoToMin` = `Intl.DateTimeFormat.formatToParts` дважды на бронь: полный
  // пересчёт всего дня происходил на каждый ре-рендер грида (ховер слота, ховер
  // карточки в каскаде, тик линии now). Зависит только от данных дня — считаем один
  // раз на загрузку.
  const packedByCol = useMemo(
    () => new Map(columns.map((c) => [c.id, packColumn(c.bookings)])),
    [columns],
  )
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
      else hoverLive.set(null)
    }, 16)
  }

  const touchDrag = useTouchDrag<CalendarBooking>({
    enabled: Boolean(onMoveBooking),
    onMove: (_b, x, y) => {
      lastPt.current = { x, y }
      const t = resolvePoint(x, y)
      if (t) setHoverSlot(t.col.id, t.min)
      else hoverLive.set(null)
      updateEdgeScroll(x, y)
    },
    onDrop: (b, x, y) => {
      stopEdgeScroll()
      hoverLive.set(null)
      const t = resolvePoint(x, y)
      if (t) commitMove(b, t.col, t.min)
      else dragSrc.current = null
    },
    onCancel: () => {
      stopEdgeScroll()
      hoverLive.set(null)
      dragSrc.current = null
    },
  })
  const touchDraggedId = touchDrag.active?.documentId

  // Подсветка по ссылке (?highlight= из пуша / из закрытия смены): карточка может
  // быть за пределами видимой области грида (вечерняя бронь, дальняя колонка) —
  // докручиваем к ней, как только день загружен и карточка отрисована.
  useEffect(() => {
    if (!highlightId || !day) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-booking-id="${highlightId}"]`)
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [highlightId, day])

  return (
    // Скролл-контейнер (обе оси): sticky ось/шапки липнут к нему; snap-x —
    // горизонтальный свайп примагничивается к границам колонок
    <div
      ref={scrollRef}
      className="h-full snap-x snap-proximity overflow-auto overscroll-contain bg-white shadow-sm dark:bg-[#1c1c1b]"
    >
      {/* pb на мобиле: нижняя пилюля даты не перекрывает последние слоты */}
      <div className="relative flex pb-20 sm:pb-0" style={{ minWidth: AXIS_W + columns.length * colW }}>
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
          const positioned = packedByCol.get(col.id) || []
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
                // колонка-день недельного вида (id = дата) vs колонка-мастер
                const isDayCol = /^\d{4}-/.test(col.id)
                // кликабельно только для реальных активных мастеров (не бывшие, не дни)
                const clickable = Boolean(onSelectMaster) && !col.id.startsWith('orphan:') && !isDayCol
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
                    {/* Аватарки/кружки мастеров убраны — в календаре лишние.
                        Junior-мастера различимы по фиолетовым карточкам броней. */}
                    {/* колонка-день показывает и число («Po 17.8.»), у мастера — только имя */}
                    <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-300">
                      {isDayCol ? col.name : col.name.split(' ')[0]}
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
                {/* Подсветка слота под курсором (свой подписчик — грид не трогает) */}
                <SlotHighlight
                  live={hoverLive}
                  colId={col.id}
                  dispOpen={dispOpen}
                  pxPerMin={pxPerMin}
                />
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

                {/* Затемнённое нерабочее время — клик открывает управление блоком.
                    Блок администратора действует только после подтверждения владельцем:
                    pending — янтарная штриховка, rejected — красная (время НЕ занимают). */}
                {col.blocks.map((bl, i) => (
                  <div
                    key={bl.documentId || i}
                    role={onSelectBlock && bl.documentId ? 'button' : undefined}
                    className={`absolute left-0.5 right-0.5 rounded-md border ${
                      bl.approval === 'pending'
                        ? 'border-dashed border-amber-500 bg-amber-400/25 dark:bg-amber-400/15'
                        : bl.approval === 'rejected'
                          ? 'border-dashed border-red-500 bg-red-400/20 dark:bg-red-400/12'
                          : 'border-transparent bg-gray-500/45 dark:bg-gray-300/20'
                    } ${
                      onSelectBlock && bl.documentId
                        ? 'cursor-pointer hover:brightness-95'
                        : 'pointer-events-none'
                    }`}
                    style={{ top: yOf(bl.startMin), height: (bl.endMin - bl.startMin) * pxPerMin }}
                    title={`${bl.title || 'Nepracovní doba'} (${fmtHM(bl.startMin)}–${fmtHM(bl.endMin)})${
                      bl.approval === 'pending'
                        ? ' — čeká na schválení majitele, termín zatím neblokuje'
                        : bl.approval === 'rejected'
                          ? ' — zamítnuto majitelem, termín neblokuje'
                          : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSelectBlock && bl.documentId) onSelectBlock(bl, col)
                    }}
                  >
                    <span className="pointer-events-none max-w-full p-2 absolute left-1.5 top-0.5 truncate text-sm font-bold text-gray-800 dark:text-gray-200">
                      {bl.title || (bl.own ? 'blok' : 'Nepracovní doba')}
                    </span>
                    {bl.approval && bl.approval !== 'approved' && (
                      <span
                        className={`pointer-events-none absolute bottom-0.5 left-1.5 truncate rounded px-1 text-[10px] font-bold uppercase tracking-wide ${
                          bl.approval === 'pending'
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {bl.approval === 'pending' ? 'čeká na schválení' : 'zamítnuto'}
                      </span>
                    )}
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
                      data-booking-id={p.booking.documentId}
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
                      {dur >= 70 &&
                        p.booking.totalPrice != null &&
                        (priceEmployeeId == null || p.booking.noonaEmployeeId === priceEmployeeId) && (
                        <div className="mt-0.5 text-[12px] font-semibold">
                          {/* Мастеру — его доля от ПОЛНОЙ цены (системную скидку несёт
                              салон, s47); админу/владельцу — фактически оплаченная сумма */}
                          {masterRate != null
                            ? `${masterShare(p.booking, masterRate) ?? p.booking.totalPrice} Kč`
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
        <TouchGhost
          point={touchDrag.point}
          hover={hoverLive}
          name={touchDrag.active.clientNameRaw || 'Rezervace'}
        />
      )}
    </div>
  )
}



