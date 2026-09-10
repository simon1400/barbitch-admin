// Пропсы шторки брони. Вынесены из calendar/BookingDrawer.tsx ДОСЛОВНО
// (этап 6 аудита): тело типа не менялось, в компоненте инлайновый литерал
// заменён ссылкой на этот интерфейс.
import type { CalendarBooking, ClientHistoryItem } from '../fetch/calendarDay'

export interface BookingDrawerProps {
  b: CalendarBooking
  onClose: () => void
  // note — необязательная позна́мка при отмене/noshow, дописывается к comment брони
  onStatus: (status: CalendarBooking['status'], notify?: boolean, note?: string) => void
  // сохранение интерн-позна́мки (карточка «Poznámka» — свободная заметка админа)
  onSaveComment: (comment: string) => void
  // блэклист клиента (карточка Kontakt) — блокирует ему запись через сайт
  onToggleBlacklist: (next: boolean) => void
  onArrived: () => void
  onOpenHistory: (r: ClientHistoryItem) => void
  onChangeService: () => void
  onReschedule: () => void
  onDelete: () => void
  // bitchcard (walk-in): применить/снять награду клиента на эту бронь
  onApplyRedemption: (code: string) => void
  onReleaseRedemption: () => void
  // скидка дозаписи (rebook −15% с thank-you): снять / вернуть
  onRemoveRebookDiscount: () => void
  onRestoreRebookDiscount: () => void
  // закрытие визита: статус брони меняет сервер, наверх сообщаем результат
  // (checkedOut после сохранения записи / active после отмены закрытия)
  onVisitClosed: () => void
  onVisitReopened: () => void
  busy: boolean
  readOnly?: boolean
  // процент мастера — если задан, «Celkem» показывает его долю, а не полную цену
  masterRate?: number | null
  // 🟥 чужая бронь у роли master (дневной рознис всех мастеров): строку «Celkem»
  // не показываем вообще — деньги коллег мастеру не видны
  hidePrice?: boolean
  // id мастера (noonaEmployeeId) — история клиента ограничивается его бронями.
  // Задаётся только для роли master; у админа/владельца null = вся история.
}
