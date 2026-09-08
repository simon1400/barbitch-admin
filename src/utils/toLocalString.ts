// 🟥 Здесь стояло 'cz-CZ' — такого языка нет (чешский = 'cs'). Тег структурно
// валиден, поэтому Intl не падал, а молча брал локаль браузера: у владельца с
// английской системой «Результат месяца» показывался как 1,234.56 вместо
// 1 234,56 — те же цифры читаются как другая сумма.
//
// Строка сюда тоже прилетала: у String.prototype.toLocaleString нет форматных
// опций, она просто вернула бы текст как есть. Приводим к числу явно.
const CS = 'cs-CZ'

export const toLocalStringDigits = (value: string | number) => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString(CS, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Целые суммы (обороты, зарплаты, налоги) — та же локаль, без копеек.
// Без неё половина плиток форматировалась локалью браузера, а половина — чешской.
export const toLocalStringInt = (value: string | number) => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString(CS, { maximumFractionDigits: 0 })
}