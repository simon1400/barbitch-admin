// Пропсы дневного грида. Вынесены из calendar/CalendarGrid.tsx ДОСЛОВНО:
// тело типа не менялось, в компоненте ссылка заменила локальное имя Props.
import type { BlockedRange, CalendarBooking, CalendarDay, MasterColumn } from '../fetch/calendarDay'
export interface CalendarGridProps {
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
  // 🟥 Гейт денег (режим master): цена рисуется ТОЛЬКО у броней этого мастера
  // (noonaEmployeeId). null = без ограничения (owner/administrator видят всё).
  priceEmployeeId?: string | null
}
