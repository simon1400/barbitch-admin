// Единый источник работы с датами и временем в админке (этап 5.1 аудита).
//
// 🟥 Семантик здесь ДВЕ, и сводить их в одну — ошибка. Аудит предлагал «решить
// одну семантику (Прага через Intl)», но это верно только для половины случаев:
//
//  1. ДЕНЬ САЛОНА (Прага). Всё, что отвечает на вопросы «какое сегодня число» и
//     «в какую минуту рабочего дня попадает этот момент». Салон в Брно, и день у
//     него пражский независимо от того, из какого часового пояса открыта админка.
//     Сюда же перевод ISO-момента (`startsAt` брони) в минуты от полуночи.
//
//  2. КАЛЕНДАРНАЯ АРИФМЕТИКА над строкой 'YYYY-MM-DD' — сдвиг на N дней,
//     понедельник недели, границы месяца, форматирование Date, собранной из
//     локальных компонентов. Здесь часовой пояс не участвует вообще: строка
//     разбирается на числа и собирается обратно. Гнать это через Прагу незачем,
//     а через UTC (`toISOString`) — прямо вредно: у полуночи по Праге получится
//     вчерашний день (этим болели `fetchHelpers` и `allAdminsHours`, чинили в s182).
//
// Практическая разница видна только когда браузер НЕ в чешском поясе — то есть
// у владельца в поездке. До s186 «сегодня» на странице календаря считалось по
// браузеру, а линия текущего времени на том же экране — по Праге.

const pad2 = (n: number) => String(n).padStart(2, '0')

// ─── 1. День салона (Прага) ─────────────────────────────────────────────────

// en-CA даёт ровно 'YYYY-MM-DD'. Форматтеры создаются один раз: конструктор
// Intl.DateTimeFormat дорогой, а зовётся это в циклах по броням.
const PRAGUE_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' })
const PRAGUE_HM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Момент времени → день салона, 'YYYY-MM-DD'. */
export const ymdPrague = (t: Date | string | number): string => PRAGUE_DAY.format(new Date(t))

/** Сегодняшний день салона, 'YYYY-MM-DD'. */
export const todayYmd = (): string => PRAGUE_DAY.format(new Date())

/**
 * Сегодняшний день салона как Date с ЛОКАЛЬНЫМИ компонентами (полночь).
 * Нужен там, где от «сегодня» дальше идёт недельная/месячная арифметика:
 * так `ymd(todayDate()) === todayYmd()` в любом часовом поясе.
 */
export const todayDate = (): Date => ymdToDate(todayYmd())

/** ISO-момент → минуты от полуночи ПО ПРАГЕ. null на пустом/битом значении. */
export const isoToMinPrague = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = new Date(iso)
  // 🟥 Проверка обязательна: formatToParts на невалидной дате БРОСАЕТ
  // 'Invalid time value'. Прежний isoToMin календаря этой проверки не имел —
  // одна битая метка времени в ответе уронила бы отрисовку всего дня (s186).
  if (Number.isNaN(t.getTime())) return null
  const parts = PRAGUE_HM.formatToParts(t)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? Number.NaN)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? Number.NaN)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

const PRAGUE_TIME_CS = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * ISO-момент → «HH:MM» ПО ПРАГЕ, для показа.
 * 🟥 Раньше это писалось как `toLocaleTimeString('cs-CZ', …)` без зоны, то есть
 * по часам браузера: карточку в сетке календарь ставил по Праге, а в шторке той
 * же брони печаталось время чужого пояса (s186).
 */
export const fmtTimePrague = (iso: string | null | undefined): string =>
  iso ? PRAGUE_TIME_CS.format(new Date(iso)) : '—'

/** Текущее время в минутах от полуночи по Праге (позиция линии «сейчас»). */
export const nowMinPrague = (): number | null => isoToMinPrague(new Date().toISOString())

// ─── 2. Календарная арифметика (часовой пояс не участвует) ──────────────────

/** Date по локальным компонентам → 'YYYY-MM-DD'. */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** Date по локальным компонентам → 'YYYY-MM'. */
export const ym = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`

/** 'YYYY-MM-DD' → Date (локальная полночь). Не `new Date(str)`: это полночь UTC. */
export const ymdToDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 'YYYY-MM-DD' ± N дней → 'YYYY-MM-DD'. */
export const addDaysYmd = (s: string, n: number): string => {
  const [y, m, d] = s.split('-').map(Number)
  return ymd(new Date(y, (m || 1) - 1, (d || 1) + n))
}

/** Date ± N дней (новый объект, исходный не меняется). */
export const addDays = (d: Date, n: number): Date => {
  const res = new Date(d)
  res.setDate(res.getDate() + n)
  return res
}

/** Понедельник недели, в которую попадает дата (полночь, локальные компоненты). */
export const startOfWeek = (d: Date): Date => {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  res.setDate(res.getDate() - ((res.getDay() + 6) % 7)) // Пн=0 … Вс=6
  return res
}

/** Понедельник недели для 'YYYY-MM-DD' → 'YYYY-MM-DD'. */
export const mondayOfYmd = (s: string): string => ymd(startOfWeek(ymdToDate(s)))

/** Число дней в месяце. month — 0-based, как `Date.getMonth()`. */
export const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate()

/** Последний день месяца, 'YYYY-MM-DD'. month — 0-based. */
export const monthEndYmd = (year: number, month: number): string => ymd(new Date(year, month + 1, 0))

/** День недели даты 'YYYY-MM-DD': 0=Вс … 6=Сб (как `Date.getDay()`). */
export const dowOfYmd = (s: string): number => ymdToDate(s).getDay()

// ─── Время внутри дня ───────────────────────────────────────────────────────

/** 'HH:MM' → минуты от полуночи. */
export const hhmmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Минуты от полуночи → 'HH:MM'. */
export const minToHHMM = (min: number): string => `${pad2(Math.floor(min / 60))}:${pad2(Math.round(min % 60))}`

// ─── Отображение ────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'DD.MM.YYYY'. Пустое значение → прочерк. */
export const fmtCsDate = (d: string | null | undefined): string => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

/** Date → 'DD.MM' (подписи недель). */
export const fmtCsShort = (d: Date): string => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`

// ─── Константы ──────────────────────────────────────────────────────────────

/** Дни недели по `Date.getDay()`: 0=Ne … 6=So. */
export const WEEKDAYS_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'] as const

/** Короткие дни недели по `Date.getDay()`: 0=Вс … 6=Сб. */
export const DOW_RU_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const

/** Полные дни недели по `Date.getDay()`. */
export const DOW_RU_FULL = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const

/** Месяцы по `Date.getMonth()`: 0=Янв … 11=Дек. */
export const MONTHS_RU = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
] as const

/** 'YYYY-MM' → 'Сен 2026'. */
export const monthLabelRu = (m: string): string => {
  const [y, mm] = m.split('-')
  return `${MONTHS_RU[Number(mm) - 1]} ${y}`
}
