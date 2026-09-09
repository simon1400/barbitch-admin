// Единственный источник денежного форматирования админки.
//
// 🟥 Почему модуль, а не одна функция: семантик здесь НЕСКОЛЬКО, и свести их
// к одной было бы ошибкой (тот же урок, что с датами в 5.1).
//
//   kc / kcNum  — деньги ЦЕЛЫМИ кронами. Так уже считала плитка «Результат
//                 месяца», а таблицы зарплат под ней показывали дроби — одна и
//                 та же сумма на одном экране выглядела по-разному.
//   kcExact     — РОВНО два знака: бухгалтерские строки с DPH, где «,00» несёт
//                 смысл «пересчитано точно», а не «случайно вышло круглым».
//   kc2         — ДО двух знаков: суммы, которые платит клиент на чекауте.
//                 Округлять их до кроны нельзя — половина кроны реальна.
//   dec         — НЕ деньги: часы администраторов. 539 записей из 1230 на проде
//                 дробные (0,5 / 0,75 / 2,45), округление до целого их сломает.
//   num         — НЕ деньги: количества (клиенты, процедуры).
//
// 🟥 Локаль объявлена ровно один раз. До этого 87 вызовов шли БЕЗ локали, то
// есть по настройкам браузера: у владельца с английской системой зарплата
// «53 200,5» читалась как «53,200.5» — те же цифры, другая сумма. Это тот же
// баг, что 'cz-CZ' в этапе 2, только молчаливее: невалидного тега здесь нет,
// поэтому ничто не намекало на проблему.
const CS = 'cs-CZ'

/**
 * Разбор денежной строки из Strapi.
 *
 * 🟥 Поля `staffSalaries`/`salonSalaries`/`tip` в базе — ТЕКСТ, и в 64 записях
 * из 7510 доля мастера записана с ЗАПЯТОЙ («445,5»). Прежние читатели
 * расходились в том, насколько тихо они это ломали:
 *   parseFloat('445,5') === 445   — дробная часть терялась молча;
 *   Number('445,5')     === NaN   — и вся сумма мастера превращалась в «NaN Kč».
 * Запятую нормализуем до разбора. `lib/verifyFlags.ts` так делал и раньше —
 * значит форма известная, просто не везде учтённая.
 */
export const parseMoney = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const n = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Нефинитное значение печатаем как есть: так вело себя `toLocaleString`, и
// подменять «NaN» нулём нельзя — это спрятало бы сбой расчёта.
const format = (value: string | number, opts: Intl.NumberFormatOptions): string => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString(CS, opts)
}

/**
 * Деньги целыми кронами, без суффикса — для ячеек, где «Kč» стоит в шапке.
 *
 * ⚠️ Округляет Intl (half-expand), а не `Math.round` (half-up). Расходятся они
 * ровно на отрицательной половине: `Math.round(-0.5)` даёт −0, Intl даёт −1.
 * Взят Intl, потому что так уже считала плитка месячного результата — она и
 * есть эталонная цифра, с которой таблицы обязаны сходиться.
 */
export const kcNum = (value: string | number): string => format(value, { maximumFractionDigits: 0 })

/** Деньги целыми кронами с суффиксом: «53 201 Kč». */
export const kc = (value: string | number): string => `${kcNum(value)} Kč`

/** Ровно два знака после запятой, без суффикса: «1 234,50». */
export const kcExact = (value: string | number): string =>
  format(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** До двух знаков, с суффиксом: «1 234,5 Kč». Точные суммы к оплате. */
export const kc2 = (value: string | number): string =>
  `${format(value, { maximumFractionDigits: 2 })} Kč`

/** Дробное число с разрядами — часы, а не деньги. */
export const dec = (value: string | number): string => format(value, { maximumFractionDigits: 2 })

/** Целое количество с разрядами — клиенты, процедуры. */
export const num = (value: string | number): string => format(value, { maximumFractionDigits: 0 })
