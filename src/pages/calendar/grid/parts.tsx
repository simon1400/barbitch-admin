// Мелкие компоненты дневного грида: подсветка слота под курсором, призрак
// брони под пальцем и закладка-лейбл. Вынесено из calendar/CalendarGrid.tsx
// ДОСЛОВНО (этап 6 аудита); отдельным файлом от geometry.ts, потому что
// react-refresh не разрешает .tsx экспортировать ещё и константы.
import { useLiveValue } from '../liveValue'
import type { LiveValue } from '../liveValue'
import type { TouchPoint } from '../useTouchDrag'
import { fmtHM } from '../utils'
import { SNAP_MIN, type HoverSlot } from './geometry'

// Подсветка слота в ОДНОЙ колонке. Отдельный компонент, потому что подписан на
// hover напрямую: пока курсор ходит по гриду, перерисовываются только эти
// прямоугольники, а не весь день с карточками (см. liveValue.ts).
export const SlotHighlight = ({
  live,
  colId,
  dispOpen,
  pxPerMin,
}: {
  live: LiveValue<HoverSlot>
  colId: string
  dispOpen: number
  pxPerMin: number
}) => {
  const hover = useLiveValue(live)
  if (hover?.colId !== colId) return null
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[5] flex items-center justify-center bg-[#e71e6e40]"
      style={{ top: (hover.min - dispOpen) * pxPerMin, height: SNAP_MIN * pxPerMin }}
    >
      <span className="absolute left-1 top-0.5 rounded bg-primary px-1 text-[10px] font-bold text-white">
        {fmtHM(hover.min)}
      </span>
      <span className="text-[18px] font-normal leading-none text-primary">+</span>
    </div>
  )
}

// Призрак под пальцем при переносе. Координаты и подпись времени тоже подписные:
// иначе каждое событие touchmove перерисовывало бы весь грид.
export const TouchGhost = ({
  point,
  hover,
  name,
}: {
  point: LiveValue<TouchPoint>
  hover: LiveValue<HoverSlot>
  name: string
}) => {
  const { x, y } = useLiveValue(point)
  const slot = useLiveValue(hover)
  return (
    <div
      className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[12px] font-bold text-white shadow-lg"
      style={{ left: x, top: y, transform: 'translate(-50%, -170%)' }}
    >
      {slot ? `${fmtHM(slot.min)} · ` : ''}
      {name}
    </div>
  )
}

// Закладка-лейбл (bookmark, как в Noona)
export const LabelMark = ({ color, name }: { color: string; name: string }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3 shrink-0 drop-shadow-sm"
    fill={color}
    aria-label={name}
  >
    <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z" />
  </svg>
)
