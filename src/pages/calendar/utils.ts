// Общие хелперы календаря: дата/время + мета статусов броней.
// fmtHM живёт здесь (единственная копия) — реэкспортится в modals/helpers.

import { addDaysYmd, fmtTimePrague, minToHHMM, mondayOfYmd, todayYmd } from '../../utils/date'
import type { CalendarBooking } from './fetch/calendarDay'

export type Mode = 'day' | 'week'

// 🟥 «Сегодня» здесь считалось по часовому поясу БРАУЗЕРА, а линия текущего
// времени на том же экране (calendarDay.nowMinPrague) — по Праге. У владельца
// в поездке календарь мог открыться на одном дне, а «сейчас» относиться к
// другому. День у салона один — пражский (s186).
export const todayStr = todayYmd

export const shiftDate = addDaysYmd

// Понедельник недели, в которой лежит dateStr
export const mondayOf = mondayOfYmd

// ISO → «HH:MM» по Праге (см. разбор в utils/date.fmtTimePrague)
export const fmtTime = fmtTimePrague

// минуты от полуночи → «HH:MM»
export const fmtHM = minToHHMM

export const STATUS_META: Record<CalendarBooking['status'], { label: string; cls: string }> = {
  active: { label: 'aktivní', cls: 'bg-pink-100 text-pink-700' },
  checkedOut: { label: '✓ proběhla', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'zrušena', cls: 'bg-gray-200 text-gray-500' },
  noshow: { label: 'nepřišla', cls: 'bg-red-100 text-red-700' },
}
