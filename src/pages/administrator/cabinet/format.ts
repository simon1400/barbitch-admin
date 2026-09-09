// Короткая дата «дд.мм» в таблицах кабинета. Перенесено дословно (этап 6).
/** Дата без года — таблицы всегда показывают один выбранный месяц. */
export const fmtDayMonth = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
