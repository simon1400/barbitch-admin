// Геометрия дневного грида, вид карточки брони и авто-лейбл по статусу.
// Вынесено из calendar/CalendarGrid.tsx ДОСЛОВНО (этап 6 аудита).
import type { CalendarBooking } from '../fetch/calendarDay'
export const COL_W = 150 // ширина колонки (десктоп)
export const COL_W_NARROW = 128 // ширина колонки на телефоне (видно ~2.5 мастера + ось)

export const PX_PER_MIN = 1.0 // высота минуты; 60 мин = 60px (компактный масштаб как в Noona)
// Телефон: базовый масштаб считается АДАПТИВНО — весь день влезает в высоту экрана
// (низ грида у нижней панели), zoomFactor умножается поверх. Эта константа — только
// фолбэк до первого замера контейнера.
export const PX_PER_MIN_NARROW = 1.0
export const MOBILE_BOTTOM_PAD = 80 // = pb-20 контента грида (клиренс нижней панели управления)
export const HEADER_H = 44 // высота шапки колонок
export const AXIS_W = 56 // ширина оси времени
export const SNAP_MIN = 30 // снап клика/переноса по гриду; точное время (шаг 15) задаётся в модале
export const EXTRA_MIN = 60 // запас шкалы: ±1 час до открытия и после закрытия (s121: было ±2ч, лишние пустые часы)
export const RIGHT_GUTTER_PCT = 10 // полоса справа от ВСЕХ карточек для клика/дозаписи на занятое время
export const OVERLAP_STEP_PCT = 10 // каскад пересекающихся карточек (как в Noona): нижняя выглядывает справа полоской этой ширины
export const EDGE_SCROLL_PX = 52 // зона у края грида, в которой перенос пальцем сам подкручивает скролл
export const EDGE_SCROLL_STEP = 10 // px за тик автоскролла (~16мс)

// Цвет карточки: бренд красно-розовый для всех статусов (как в Noona), junior —
// фиолетовый. Статус различается ЛЕЙБЛОМ (закладка в углу), отменённые — полупрозрачные,
// noshow — полупрозрачные ЖЁЛТЫЕ (в тон их авто-лейбла «Nedostavil/a se» #f59e0b).
export const cardStyle = (
  booking: CalendarBooking,
  tier?: 'senior' | 'junior',
): { bg: string; border: string; text: string; opacity: number } => {
  if (booking.status === 'noshow') {
    return { bg: '#f59e0b', border: '#d97706', text: '#ffffff', opacity: 0.45 }
  }
  const base =
    tier === 'junior'
      ? { bg: '#a78bfa', border: '#8b5cf6', text: '#ffffff' } // junior — фиолетовый
      : { bg: '#fd80cc', border: '#f45bb8', text: '#ffffff' } // бренд розовый
  return { ...base, opacity: booking.status === 'cancelled' ? 0.45 : 1 }
}

// Авто-лейбл по статусу (как stavy в Noona); active → кастомный лейбл брони (если задан)
export const bookingLabel = (b: CalendarBooking): { name: string; color: string } | null => {
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

// Подсвеченный слот: колонка + минута начала получасовой клетки под курсором/пальцем
export type HoverSlot = { colId: string; min: number } | null
