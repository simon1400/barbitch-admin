export const getWeekRange = (year: number, month: number, weekNumber: number) => {
  // Вычисляем начало недели (weekNumber: 0 = первая неделя месяца)
  const startDay = weekNumber * 7 + 1
  const firstDay = new Date(Date.UTC(year, month, startDay, 0, 0, 0, 0))

  // Конец недели (7 дней от начала)
  const lastDay = new Date(Date.UTC(year, month, startDay + 6, 23, 59, 59, 999))

  // Убеждаемся, что не выходим за пределы месяца
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

  return {
    firstDay,
    lastDay: lastDay > lastDayOfMonth ? lastDayOfMonth : lastDay,
  }
}

// Альтернативный вариант: получить неделю по конкретной дате
export const getCurrentWeekRange = (date: Date = new Date()) => {
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

// Получить диапазон недели по ISO стандарту (неделя начинается с понедельника)
export const getISOWeekRange = (year: number, weekNumber: number) => {
  // Находим 4 января (это всегда в первой неделе года по ISO)
  const jan4 = new Date(Date.UTC(year, 0, 4))

  // Находим понедельник первой недели
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7)

  // Вычисляем начало нужной недели
  const firstDay = new Date(firstMonday)
  firstDay.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  firstDay.setHours(0, 0, 0, 0)

  // Конец недели (воскресенье)
  const lastDay = new Date(firstDay)
  lastDay.setDate(firstDay.getDate() + 6)
  lastDay.setHours(23, 59, 59, 999)

  return { firstDay, lastDay }
}