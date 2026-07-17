// Календарь резервационной системы (own-booking). Источник данных — ТОЛЬКО наша
// локальная БД (Strapi): booking / salon-hour / time-block / personal. Noona здесь
// НЕ участвует (на локале строим систему такой, какой она будет после отключения
// Noona). Все GET с явным Bearer (booking содержит PII → Public-права не включаем).

import { Axios } from '../../../lib/api'

const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const authHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined

export interface CalendarService {
  title: string
  price: number | null
  durationMin: number | null
}

export interface CalendarBooking {
  id: number
  documentId: string
  clientNameRaw: string
  employeeNameRaw: string
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
  status: 'active' | 'checkedOut' | 'cancelled' | 'noshow'
  // клиент dorazil (промежуточный шаг перед checkedOut) — зелёный лейбл на карточке
  arrived?: boolean
  services: CalendarService[] | null
  totalPrice: number | null
  comment: string | null
  customerComment: string | null
  bsChannel: string | null
  // происхождение брони: 'site' | 'admin' (движок) или сырой origin Noona (зеркало)
  origin: string | null
  // имя админа, создавшего бронь из календаря (adminCreateBooking)
  createdByName: string | null
  // момент создания: noonaCreatedAt у зеркальных, createdAt (Strapi) у движковых
  createdAt: string | null
  noonaCreatedAt: string | null
  // клиент (populate) — documentId для истории, email для дефолта чекбокса
  // уведомления, phone+email показываются в drawer (контакт для администратора),
  // blacklisted — статус/toggle блэклиста в карточке Kontakt
  client?: {
    documentId?: string
    email?: string | null
    phone?: string | null
    name?: string | null
    blacklisted?: boolean | null
  } | null
  // кастомный лейбл (снапшот из справочника booking-label)
  label?: { name: string; color: string } | null
}

export interface BlockedRange {
  startMin: number
  endMin: number
  documentId?: string
  title?: string
  own?: boolean // блок нашего движка (noonaKey 'own|…') — управляем из календаря
  // ключи серии: own-серия делит noonaKey; зеркальная rrule-серия делит noonaBlockedId
  noonaKey?: string | null
  noonaBlockedId?: string | null
}

export interface MasterColumn {
  id: string // id мастера (personal.noonaEmployeeId — стабильный ключ в нашей БД) или дата (неделя)
  name: string
  employeeDocId?: string // personal.documentId — для write-операций движка
  date?: string // дата колонки (день = дата вида, неделя = своя на колонку)
  tier?: 'senior' | 'junior' // junior → фиолетовые карточки броней
  photoUrl?: string | null // фото мастера (personal.photo, thumbnail) — аватарка в шапке колонки
  photoFullUrl?: string | null // полноразмерное фото — увеличенное превью по ховеру
  bookings: CalendarBooking[]
  blocks: BlockedRange[]
  showNow?: boolean // рисовать линию текущего времени в этой колонке
}

export interface CalendarEmployee {
  id: string
  docId: string
  name: string
  tier: 'senior' | 'junior'
  calendarOrder: number
  // процент мастера от цены услуги (для показа его доли в календаре мастера)
  ratePercent: number | null
  photoUrl: string | null
  photoFullUrl: string | null
}

export interface CalendarDay {
  openMin: number
  closeMin: number
  columns: MasterColumn[]
}

// Минуты от полуночи в часовом поясе Праги (сервер/браузер-независимо)
const HM_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const isoToMin = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const parts = HM_FMT.formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

const DEFAULT_OPEN = 9 * 60
const DEFAULT_CLOSE = 20 * 60

interface RawPersonal {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  tier: 'senior' | 'junior' | null
  calendarOrder: number | null
  ratePercent: number | null
  photo?: { url?: string | null; formats?: { thumbnail?: { url?: string | null } } | null } | null
}

// Локальный /uploads → абсолютный URL Strapi; прод (ImageKit) уже абсолютный
const STRAPI_BASE = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const absUrl = (u: string | null | undefined): string | null => {
  if (!u) return null
  return u.startsWith('http') ? u : `${STRAPI_BASE}${u}`
}
// тумба для кружка-аватарки; полный размер — для увеличенного превью
const personalPhotoUrl = (p: RawPersonal): string | null =>
  absUrl(p.photo?.formats?.thumbnail?.url || p.photo?.url)
const personalPhotoFullUrl = (p: RawPersonal): string | null => absUrl(p.photo?.url)
interface MirrorSalonHour {
  date: string
  openMin: number | null
  closeMin: number | null
}
interface MirrorTimeBlock {
  documentId: string
  noonaEmployeeId: string
  noonaKey: string | null
  noonaBlockedId?: string | null
  title: string | null
  date: string
  startsAt: string | null
  endsAt: string | null
}

// Активные мастера из НАШЕЙ базы (personal). Ключ колонки = noonaEmployeeId
// (стабильный id сотрудника в наших данных); docId — для write-операций движка.
// Порядок колонок = personal.calendarOrder (меньше — левее), fallback алфавит.
export async function fetchEmployees(): Promise<CalendarEmployee[]> {
  const res = (await Axios.get(
    `/api/personals?filters[isActive][$eq]=true&fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=position&fields[3]=tier&fields[4]=calendarOrder&fields[5]=ratePercent&populate[photo][fields][0]=url&populate[photo][fields][1]=formats&pagination[pageSize]=100`,
    { headers: authHeaders },
  )) as RawPersonal[]
  // Запрос уже фильтрует isActive=true; здесь только отсекаем без noona-id и ❌
  return (res || [])
    .filter((p) => p.noonaEmployeeId && !p.name.startsWith('❌'))
    .map((p) => ({
      id: p.noonaEmployeeId as string,
      docId: p.documentId,
      name: p.name.trim(),
      tier: p.tier === 'junior' ? ('junior' as const) : ('senior' as const),
      calendarOrder: p.calendarOrder ?? 0,
      ratePercent: p.ratePercent ?? null,
      photoUrl: personalPhotoUrl(p),
      photoFullUrl: personalPhotoFullUrl(p),
    }))
    .sort((a, b) => a.calendarOrder - b.calendarOrder || a.name.localeCompare(b.name, 'cs'))
}

// Сохранение порядка колонок: personal.calendarOrder пишется в ОБЕ версии
// (draft + published — календарь читает published; паттерн каталога s101).
// Мутации идут через admin-Axios (интерсептор подставляет VITE_STRAPI_TOKEN на PUT).
export async function saveEmployeesOrder(items: { docId: string; order: number }[]): Promise<void> {
  for (const it of items) {
    await Axios.put(`/api/personals/${it.docId}`, { data: { calendarOrder: it.order } })
    await Axios.put(`/api/personals/${it.docId}?status=published`, { data: { calendarOrder: it.order } })
  }
}

// История клиента: все его брони (прошлые + будущие) для секции в drawer.
// Матч по client.documentId (стабильно), фолбэк по имени если связи нет (импорт).
export interface ClientHistoryItem {
  documentId: string
  date: string
  startsAt: string | null
  status: CalendarBooking['status']
  employeeNameRaw: string
  services: CalendarService[] | null
  totalPrice: number | null
}

export async function fetchClientHistory(opts: {
  clientDocId?: string | null
  clientName?: string | null
  // Ограничение выборки одним мастером (роль master видит только СВОИ брони
  // с этим клиентом — визиты к другим мастерам ему не показываются). Фильтр
  // уходит в запрос → чужие брони в браузер мастера вообще не приезжают.
  employeeNoonaId?: string | null
}): Promise<ClientHistoryItem[]> {
  const base = opts.clientDocId
    ? `filters[client][documentId][$eq]=${opts.clientDocId}`
    : opts.clientName
      ? `filters[clientNameRaw][$eq]=${encodeURIComponent(opts.clientName)}`
      : null
  if (!base) return []
  const empFilter = opts.employeeNoonaId
    ? `&filters[noonaEmployeeId][$eq]=${encodeURIComponent(opts.employeeNoonaId)}`
    : ''
  const res = (await Axios.get(
    `/api/bookings?${base}${empFilter}&sort=startsAt:desc&fields[0]=date&fields[1]=startsAt&fields[2]=status&fields[3]=employeeNameRaw&fields[4]=services&fields[5]=totalPrice&pagination[pageSize]=200`,
    { headers: authHeaders },
  )) as ClientHistoryItem[]
  return res || []
}

// Расписание дня из нашей БД: часы салона (salon-hour) + блоки мастеров (time-block).
// Нет salon-hour на дату → дефолтное окно, без блоков (движок будет владеть часами).
async function fetchSchedule(
  dateStr: string,
): Promise<{ openMin: number; closeMin: number; blocksByEmp: Map<string, BlockedRange[]> }> {
  const [hourRes, blockRes] = await Promise.all([
    Axios.get(`/api/salon-hours?filters[date][$eq]=${dateStr}`, { headers: authHeaders }) as Promise<
      MirrorSalonHour[]
    >,
    Axios.get(`/api/time-blocks?filters[date][$eq]=${dateStr}&pagination[pageSize]=300`, {
      headers: authHeaders,
    }) as Promise<MirrorTimeBlock[]>,
  ])
  const hour = (hourRes || [])[0]

  let openMin = DEFAULT_OPEN
  let closeMin = DEFAULT_CLOSE
  if (hour?.openMin != null && hour?.closeMin != null) {
    openMin = hour.openMin
    closeMin = hour.closeMin
  }
  const blocksByEmp = new Map<string, BlockedRange[]>()
  for (const b of blockRes || []) {
    const s = isoToMin(b.startsAt)
    const e = isoToMin(b.endsAt)
    if (!b.noonaEmployeeId || s == null || e == null || e <= s) continue
    const arr = blocksByEmp.get(b.noonaEmployeeId) || []
    arr.push(toBlockedRange(b, s, e))
    blocksByEmp.set(b.noonaEmployeeId, arr)
  }
  return { openMin, closeMin, blocksByEmp }
}

const toBlockedRange = (b: MirrorTimeBlock, startMin: number, endMin: number): BlockedRange => ({
  startMin,
  endMin,
  documentId: b.documentId,
  title: b.title || undefined,
  own: String(b.noonaKey || '').startsWith('own|'),
  noonaKey: b.noonaKey,
  noonaBlockedId: b.noonaBlockedId ?? null,
})

// Занятые интервалы колонки (для подсказки «служба se nevejde» в модале новой брони).
// Только active-брони + блоки блокируют слот — движок конфликтует ровно по ним
// (cancelled/checkedOut/noshow НЕ блокируют, дозапись поверх них допустима).
export function busyIntervals(col: MasterColumn): { startMin: number; endMin: number }[] {
  const out: { startMin: number; endMin: number }[] = []
  for (const b of col.bookings) {
    if (b.status !== 'active') continue
    const s = isoToMin(b.startsAt)
    const e = isoToMin(b.endsAt)
    if (s != null && e != null && e > s) out.push({ startMin: s, endMin: e })
  }
  for (const bl of col.blocks) out.push({ startMin: bl.startMin, endMin: bl.endMin })
  return out
}

export async function fetchCalendarDay(dateStr: string): Promise<CalendarDay> {
  const [bookingsRes, employees, schedule] = await Promise.all([
    Axios.get(
      `/api/bookings?filters[date][$eq]=${dateStr}&sort=startsAt:asc&populate[client][fields][0]=email&populate[client][fields][1]=phone&populate[client][fields][2]=blacklisted&pagination[pageSize]=200`,
      { headers: authHeaders },
    ) as Promise<CalendarBooking[]>,
    fetchEmployees(),
    fetchSchedule(dateStr),
  ])

  const bookings = bookingsRes || []
  let { openMin, closeMin } = schedule
  const { blocksByEmp } = schedule

  // Брони по мастеру (по noonaEmployeeId зеркала)
  const bookingsByEmp = new Map<string, CalendarBooking[]>()
  const orphan: CalendarBooking[] = []
  for (const bk of bookings) {
    if (bk.noonaEmployeeId && employees.some((e) => e.id === bk.noonaEmployeeId)) {
      const arr = bookingsByEmp.get(bk.noonaEmployeeId) || []
      arr.push(bk)
      bookingsByEmp.set(bk.noonaEmployeeId, arr)
    } else {
      orphan.push(bk)
    }
  }

  const isToday = todayStrPrague() === dateStr
  const columns: MasterColumn[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeDocId: e.docId,
    date: dateStr,
    tier: e.tier,
    photoUrl: e.photoUrl,
    photoFullUrl: e.photoFullUrl,
    bookings: bookingsByEmp.get(e.id) || [],
    blocks: blocksByEmp.get(e.id) || [],
    showNow: isToday,
  }))

  // Брони бывших сотрудников (нет в списке активных) — отдельной колонкой (read-only)
  if (orphan.length) {
    const byName = new Map<string, CalendarBooking[]>()
    for (const b of orphan) {
      const key = b.employeeNameRaw || 'Bývalý mistr'
      const arr = byName.get(key) || []
      arr.push(b)
      byName.set(key, arr)
    }
    for (const [name, list] of byName) {
      columns.push({ id: `orphan:${name}`, name, date: dateStr, bookings: list, blocks: [], showNow: isToday })
    }
  }

  // Расширить окно под брони/блоки за его пределами
  for (const col of columns) {
    for (const b of col.bookings) {
      const s = isoToMin(b.startsAt)
      const e = isoToMin(b.endsAt)
      if (s != null) openMin = Math.min(openMin, s)
      if (e != null) closeMin = Math.max(closeMin, e)
    }
    for (const bl of col.blocks) {
      openMin = Math.min(openMin, bl.startMin)
      closeMin = Math.max(closeMin, bl.endMin)
    }
  }
  openMin = Math.floor(openMin / 60) * 60
  closeMin = Math.ceil(closeMin / 60) * 60

  return { openMin, closeMin, columns }
}

// Лейн-паковка пересекающихся броней внутри колонки (side-by-side)
export interface PositionedBooking {
  booking: CalendarBooking
  startMin: number
  endMin: number
  lane: number
  lanes: number
}

export function packColumn(bookings: CalendarBooking[]): PositionedBooking[] {
  const items = bookings
    .map((b) => ({ b, s: isoToMin(b.startsAt), e: isoToMin(b.endsAt) }))
    .filter((x): x is { b: CalendarBooking; s: number; e: number } => x.s != null && x.e != null && x.e > x.s)
    .sort((a, b) => a.s - b.s || a.e - b.e)

  const result: PositionedBooking[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  // приоритет слоя внутри пересечения: активная бронь всегда сверху (lane 0, во всю
  // ширину и читаема), отменённые/noshow уходят под неё и выглядывают сзади
  const statusRank = (s: string) => (s === 'active' ? 0 : s === 'checkedOut' ? 1 : s === 'noshow' ? 2 : 3)

  const flush = () => {
    if (!cluster.length) return
    const laneEnds: number[] = []
    // порядок назначения lane: сначала активные (получат меньший lane), затем по
    // времени начала; кластеризация выше идёт по времени старта и не ломается
    const ordered = [...cluster].sort((a, b) => statusRank(a.b.status) - statusRank(b.b.status) || a.s - b.s || a.e - b.e)
    const placed = ordered.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.s)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(it.e)
      } else {
        laneEnds[lane] = it.e
      }
      return { it, lane }
    })
    const lanes = laneEnds.length
    for (const { it, lane } of placed) {
      result.push({ booking: it.b, startMin: it.s, endMin: it.e, lane, lanes })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.e)
  }
  flush()
  return result
}

// 'YYYY-MM-DD' сегодня в Праге
export function todayStrPrague(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
}

// Текущее время в минутах от полуночи (Прага) — позиция линии now
export function nowMinPrague(): number | null {
  return isoToMin(new Date().toISOString())
}

// ── Недельный вид: неделя ОДНОГО мастера, колонки = дни ──
const WEEKDAYS_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

export async function fetchWeekEmployees(): Promise<CalendarEmployee[]> {
  return fetchEmployees()
}

// monday = 'YYYY-MM-DD' (Пн)
export async function fetchCalendarWeek(
  monday: string,
  employee: CalendarEmployee,
): Promise<CalendarDay> {
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = monday.split('-').map(Number)
    const dt = new Date(y, m - 1, d + i)
    days.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
  }
  const sunday = days[6]

  const [bookingsRes, hoursRes, blocksRes] = await Promise.all([
    Axios.get(
      `/api/bookings?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&filters[noonaEmployeeId][$eq]=${employee.id}&sort=startsAt:asc&populate[client][fields][0]=email&populate[client][fields][1]=phone&populate[client][fields][2]=blacklisted&pagination[pageSize]=300`,
      { headers: authHeaders },
    ) as Promise<CalendarBooking[]>,
    Axios.get(`/api/salon-hours?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&pagination[pageSize]=10`, {
      headers: authHeaders,
    }) as Promise<MirrorSalonHour[]>,
    Axios.get(
      `/api/time-blocks?filters[date][$gte]=${monday}&filters[date][$lte]=${sunday}&filters[noonaEmployeeId][$eq]=${employee.id}&pagination[pageSize]=100`,
      { headers: authHeaders },
    ) as Promise<MirrorTimeBlock[]>,
  ])

  const bookings = bookingsRes || []
  const bookingsByDate = new Map<string, CalendarBooking[]>()
  for (const b of bookings) {
    const arr = bookingsByDate.get(b.date) || []
    arr.push(b)
    bookingsByDate.set(b.date, arr)
  }
  const blocksByDate = new Map<string, BlockedRange[]>()
  for (const bl of blocksRes || []) {
    const s = isoToMin(bl.startsAt)
    const e = isoToMin(bl.endsAt)
    if (s == null || e == null || e <= s) continue
    const arr = blocksByDate.get(bl.date) || []
    arr.push(toBlockedRange(bl, s, e))
    blocksByDate.set(bl.date, arr)
  }

  let openMin = DEFAULT_OPEN
  let closeMin = DEFAULT_CLOSE
  const hours = hoursRes || []
  const opens = hours.map((h) => h.openMin).filter((v): v is number => v != null)
  const closes = hours.map((h) => h.closeMin).filter((v): v is number => v != null)
  if (opens.length && closes.length) {
    openMin = Math.min(...opens)
    closeMin = Math.max(...closes)
  }

  const today = todayStrPrague()
  const columns: MasterColumn[] = days.map((date) => {
    const [y, m, d] = date.split('-').map(Number)
    const wd = WEEKDAYS_CS[new Date(y, m - 1, d).getDay()]
    return {
      id: date,
      name: `${wd} ${d}.${m}.`,
      employeeDocId: employee.docId,
      date,
      tier: employee.tier,
      bookings: bookingsByDate.get(date) || [],
      blocks: blocksByDate.get(date) || [],
      showNow: date === today,
    }
  })

  for (const col of columns) {
    for (const b of col.bookings) {
      const s = isoToMin(b.startsAt)
      const e = isoToMin(b.endsAt)
      if (s != null) openMin = Math.min(openMin, s)
      if (e != null) closeMin = Math.max(closeMin, e)
    }
    for (const bl of col.blocks) {
      openMin = Math.min(openMin, bl.startMin)
      closeMin = Math.max(closeMin, bl.endMin)
    }
  }
  openMin = Math.floor(openMin / 60) * 60
  closeMin = Math.ceil(closeMin / 60) * 60

  return { openMin, closeMin, columns }
}

// ── Кто в этот день администратор ────────────────────────────────────────────
// Источник — коллекция shift («Рабочие смены»): плановый график, который админы
// ведут ЗАРАНЕЕ, по одной записи на неделю (from = понедельник, days.monday…sunday
// = имя дежурного, напр. «Вика»/«Оля»).
//
// Почему НЕ work-time («Рабочие часы»): та запись создаётся по факту, в конце
// смены (проверено на проде: created_at 16:30–20:50 того же дня) → днём, когда
// эта инфа и нужна, её ещё нет. График же лежит заранее.
//
// status=draft — отдаёт черновую версию ВСЕХ документов, т.е. и уже закрытые
// недели, и ещё не опубликованный будущий график. Без явного Bearer (PII нет).

export type AdminRoster = Record<string, string> // 'YYYY-MM-DD' → имя дежурного

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

interface RawShift {
  from: string
  days?: Partial<Record<(typeof DAY_KEYS)[number], string | null>> | null
}

// График недели, в которую попадает monday (= результат mondayOf).
// Матчим по `from` (у всех записей это понедельник), а НЕ по диапазону from..to:
// поле `to` местами заполнено с опечаткой (есть запись с to === from).
export async function fetchAdminRoster(monday: string): Promise<AdminRoster> {
  try {
    const res = (await Axios.get(
      `/api/shifts?filters[from][$eq]=${monday}&fields[0]=from&populate=days&pagination[pageSize]=5&status=draft`,
    )) as RawShift[]
    const days = (res || [])[0]?.days
    if (!days) return {}
    const roster: AdminRoster = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${monday}T12:00:00`)
      d.setDate(d.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const name = (days[DAY_KEYS[d.getDay()]] || '').trim()
      if (name) roster[dateStr] = name
    }
    return roster
  } catch {
    return {} // график — вспомогательная инфа, календарь из-за неё не роняем
  }
}
