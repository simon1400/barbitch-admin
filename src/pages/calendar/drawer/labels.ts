// Подписи шторки брони: канал источника, кем и когда создана, чешская дата.
// Вынесено из calendar/BookingDrawer.tsx ДОСЛОВНО (этап 6 аудита).

import { WEEKDAYS_CS, dowOfYmd } from '../../../utils/date'
import type { CalendarBooking } from '../fetch/calendarDay'

const CHANNEL_LABELS: Record<string, string> = {
  bookingLink: 'web (rezervační odkaz)',
  calendar: 'Noona kalendář (ručně)',
  app: 'aplikace Noona',
  web: 'web noona.app',
  reserveWithGoogle: 'Google',
}

// «Кем/через что» создана бронь: движковые по origin (site/admin+имя админа),
// зеркальные Noona — по bsChannel (fallback сырой origin)
export const bookingSourceLabel = (b: CalendarBooking): string | null => {
  if (b.origin === 'admin') return b.createdByName ? `kalendář — ${b.createdByName}` : 'kalendář (admin)'
  if (b.origin === 'site') return 'web barbitch.cz'
  const ch = b.bsChannel || b.origin
  return ch ? (CHANNEL_LABELS[ch] ?? ch) : null
}

// Момент создания брони: зеркальные несут noonaCreatedAt, движковые — createdAt
export const bookingCreatedLabel = (b: CalendarBooking): string | null => {
  const iso = b.noonaCreatedAt || b.createdAt
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// «Ne 19. 7. 2026» — дата брони с днём недели (сразу видно, о каком дне речь)
export const dateLabelCs = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${WEEKDAYS_CS[dowOfYmd(dateStr)]} ${d}. ${m}. ${y}`
}

// Drawer с деталями брони + кнопки статусов (пишут в движок).
// readOnly (роль master): чисто информационный вид — без кнопок статусов/переноса/
// смены услуги/лейблов/удаления; детали и история клиента остаются.
