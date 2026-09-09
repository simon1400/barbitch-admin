import { todayDate } from './date'
// Диапазон текущей недели (понедельник..воскресенье) в UTC.
// Единственный потребитель — dashboard/hooks/useGlobalWeekData.ts.
export const getCurrentWeekRange = (date: Date = todayDate()) => {
  const currentDate = new Date(date)

  // Получаем день недели (0 = воскресенье, 1 = понедельник, ...)
  const dayOfWeek = currentDate.getDay()

  // Вычисляем начало недели (понедельник) используя UTC
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const dayOfMonth = currentDate.getDate()

  // Создаем даты в UTC, чтобы избежать проблем с часовыми поясами
  const firstDay = new Date(Date.UTC(year, month, dayOfMonth + diff, 0, 0, 0, 0))

  // Вычисляем конец недели (воскресенье)
  const lastDay = new Date(Date.UTC(year, month, dayOfMonth + diff + 6, 23, 59, 59, 999))

  return { firstDay, lastDay }
}
