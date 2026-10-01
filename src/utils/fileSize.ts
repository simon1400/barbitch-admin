/** «1,2 МБ», «340 КБ» — размер скана сотрудника или чека затраты. */
export const fmtSize = (bytes: number): string => {
  if (!bytes) return '—'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`
}
