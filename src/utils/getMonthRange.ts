export const getMonthRange = (year: number, month: number) => {
  const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

  return { firstDay, lastDay }
}
