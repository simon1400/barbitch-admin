// Перенос карточек ПАЛЬЦЕМ (планшет/телефон).
//
// Зачем свой жест: HTML5 drag-and-drop на тач-экранах не работает — браузер трактует
// движение пальца как скролл и событий dragstart/drop просто не присылает. Поэтому:
// удержание LONG_PRESS_MS на карточке «поднимает» её (вибро + призрак под пальцем),
// дальше тянем, отпускание = дроп. Пока удержание не сработало, обычный скролл грида
// жив — сдвиг больше MOVE_TOLERANCE до активации отменяет жест (значит, это скролл).
//
// 🟥 Скролл во время переноса глушится через preventDefault на touchmove, а он
// действует ТОЛЬКО в non-passive слушателе → вешаем нативно (touchmove у React
// пассивный, его preventDefault молча игнорируется). Работает потому, что к моменту
// активации палец неподвижен и браузер скролл ещё не начал.

import { useCallback, useEffect, useRef, useState } from 'react'

const LONG_PRESS_MS = 400 // столько держим, чтобы «поднять» карточку
const MOVE_TOLERANCE = 10 // px: уехали раньше активации → это скролл, не перенос

export type TouchDragActive<T> = { item: T; x: number; y: number }

type DragState<T> = {
  item: T
  x: number
  y: number
  active: boolean
  timer: ReturnType<typeof setTimeout> | null
  move: (e: TouchEvent) => void
  end: (e: TouchEvent) => void
}

type Options<T> = {
  enabled: boolean
  onMove: (item: T, x: number, y: number) => void
  onDrop: (item: T, x: number, y: number) => void
  onCancel?: () => void
}

export const useTouchDrag = <T,>(options: Options<T>) => {
  // опции держим в ref: слушатели вешаются один раз на жест и не должны
  // ловить устаревшие колбэки (грид перерисовывается поллингом раз в 25с)
  const opts = useRef(options)
  opts.current = options

  const [active, setActive] = useState<TouchDragActive<T> | null>(null)
  const st = useRef<DragState<T> | null>(null)

  const teardown = useCallback((drop: boolean) => {
    const s = st.current
    if (!s) return
    st.current = null
    if (s.timer) clearTimeout(s.timer)
    document.removeEventListener('touchmove', s.move)
    document.removeEventListener('touchend', s.end)
    document.removeEventListener('touchcancel', s.end)
    if (!s.active) return
    setActive(null)
    if (drop) opts.current.onDrop(s.item, s.x, s.y)
    else opts.current.onCancel?.()
  }, [])

  // размонтирование посреди жеста не должно оставить слушатели на document
  useEffect(() => () => teardown(false), [teardown])

  const start = useCallback(
    (e: React.TouchEvent, item: T) => {
      if (!opts.current.enabled || e.touches.length !== 1) return
      teardown(false)
      const t = e.touches[0]
      const s: DragState<T> = {
        item,
        x: t.clientX,
        y: t.clientY,
        active: false,
        timer: null,
        move: () => {},
        end: () => {},
      }

      s.move = (ev: TouchEvent) => {
        const p = ev.touches[0]
        if (!p) return
        if (!s.active) {
          if (Math.hypot(p.clientX - s.x, p.clientY - s.y) > MOVE_TOLERANCE) teardown(false)
          return
        }
        ev.preventDefault() // глушим скролл, пока тащим
        s.x = p.clientX
        s.y = p.clientY
        setActive({ item: s.item, x: s.x, y: s.y })
        opts.current.onMove(s.item, s.x, s.y)
      }
      s.end = (ev: TouchEvent) => {
        // без preventDefault после дропа прилетит синтетический click → откроется drawer
        if (s.active) ev.preventDefault()
        teardown(s.active && ev.type === 'touchend')
      }
      s.timer = setTimeout(() => {
        s.timer = null
        s.active = true
        navigator.vibrate?.(25)
        setActive({ item: s.item, x: s.x, y: s.y })
        opts.current.onMove(s.item, s.x, s.y)
      }, LONG_PRESS_MS)

      st.current = s
      document.addEventListener('touchmove', s.move, { passive: false })
      document.addEventListener('touchend', s.end, { passive: false })
      document.addEventListener('touchcancel', s.end, { passive: false })
    },
    [teardown]
  )

  return { active, start }
}
