import qs from 'qs'
import { Axios } from '../../../../lib/api'
import { NoonaHQ } from '../../../../lib/noona'
import { fetchEmployees, type Employee } from '../../noona/fetch/masterServices'
import { getScheduleGaps, type MasterGapsRow } from './scheduleGaps'
import { dateToStr } from './masterLoad'
import { getEventsHistory, isActive } from '../../analytics/fetch/eventsHistory'

// ─── Cross-sell «дозапись в окно» ──────────────────────────────────────────────
// Идея: клиент уже записан в категории X (брови / ресницы / маникюр). Если у
// мастера ДРУГОЙ категории есть свободное окно, начинающееся СРАЗУ ПОСЛЕ (≤15 мин)
// окончания её процедуры и достаточно длинное под услугу той категории — за 1–2
// дня шлём письмо со скидкой 15% и предложением дозаписаться в это окно.
//
// Якорь = ПОСЛЕДНЯЯ бронь клиента в этот день (нет риска пересечения с её же
// последующими записями; «hned po vaší návštěvě»). Один кандидат на клиента/день.
// Дедуп по id брони-якоря через коллекцию window-offer-log.

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string
const CLIENT_URL = (import.meta.env.VITE_CLIENT_URL as string) || 'https://barbitch.cz'

// Окно должно начинаться не позже чем через столько минут после конца процедуры
export const WINDOW_TOLERANCE_MIN = 15

// Предлагаем только короткие услуги (дозапись «между делом») — не длиннее этого.
// Длинные процедуры под дозапись в окно не предлагаем.
export const MAX_OFFER_SERVICE_MIN = 60

export type Bucket = 'manicure' | 'brows' | 'lashes'
const ALL_BUCKETS: Bucket[] = ['manicure', 'brows', 'lashes']

export const BUCKET_LABEL: Record<Bucket, string> = {
  manicure: 'Маникюр',
  brows: 'Брови',
  lashes: 'Ресницы',
}
// Для текста письма (чешский, в нижнем регистре — встраивается в предложение)
export const BUCKET_LABEL_CS: Record<Bucket, string> = {
  manicure: 'manikúra',
  brows: 'obočí',
  lashes: 'řasy',
}

// Классификация по названию услуги/категории. Покрывает базовые услуги, combo и
// junior-копии (их title содержит те же ключевые слова). Порядок важен: «řas»
// (ресницы) проверяем до «obočí», маникюр — последним.
// ⚠️ При добавлении новых категорий в Noona — дополнить ключевые слова.
export const classifyTitle = (raw: string): Bucket | null => {
  const t = raw.toLowerCase()
  if (t.includes('řas') || t.includes('rias') || t.includes('lash')) return 'lashes'
  // Брови: многие услуги БЕЗ слова «obočí» (Laminace, Úprava tvaru, Korekce…).
  // «laminace»/«úprava tvaru» здесь безопасны — ресничные ловятся выше по «řas».
  if (
    t.includes('obočí') ||
    t.includes('oboci') ||
    t.includes('brow') ||
    t.includes('barvení a péče') ||
    t.includes('laminace') ||
    t.includes('úprava tvaru') ||
    t.includes('uprava tvaru')
  )
    return 'brows'
  const nailKeys = [
    'nehty',
    'manikúra',
    'manikura',
    'gel lak',
    'prodloužení neht',
    'nano',
    'sundání',
    'hygienick',
    'ibx',
  ]
  if (nailKeys.some((k) => t.includes(k))) return 'manicure'
  return null
}

// НЕ предлагаем для дозаписи не-базовые услуги — только новые базовые. Исключаем:
// снятия/удаления (Sundání, Odstranění) и доливы/коррекции (Doplnění — делается
// поверх существующей работы, не подходит как самостоятельное предложение).
// Фильтр применяется только к ПРЕДЛАГАЕМЫМ услугам (bucketServices), не к классификации
// текущей брони клиента. ⚠️ при новых не-базовых названиях дополнить список.
const NON_BASE_KEYWORDS = ['sundání', 'sundani', 'odstranění', 'odstraneni', 'doplnění', 'doplneni']
const isExcludedOfferService = (title: string): boolean => {
  const t = title.toLowerCase()
  return NON_BASE_KEYWORDS.some((k) => t.includes(k))
}

// ─── Время ──────────────────────────────────────────────────────────────────
const hhmmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const isoToMin = (iso: string): number => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
const addDays = (d: Date, n: number): Date => {
  const res = new Date(d)
  res.setDate(res.getDate() + n)
  return res
}
// '2026-06-16' → '16. 6. 2026'
const fmtCsDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

// ─── Noona fetch ──────────────────────────────────────────────────────────────
interface RawBookingEvent {
  id?: string
  customer?: string
  customer_name?: string
  employee?: string
  status?: string
  event_date?: string
  starts_at?: string
  ends_at?: string
  event_types?: Array<{ id?: string; title?: string }>
}

// Брони кандидатных дней (завтра/послезавтра) — полный набор полей, окно крошечное
const fetchDayBookings = async (fromStr: string, toStr: string): Promise<RawBookingEvent[]> => {
  const params = new URLSearchParams()
  params.append(
    'filter',
    JSON.stringify({ from: `${fromStr}T00:00:00.000Z`, to: `${toStr}T23:59:59.999Z` }),
  )
  for (const f of [
    'id',
    'customer',
    'customer_name',
    'employee',
    'status',
    'event_date',
    'starts_at',
    'ends_at',
    'event_types.id',
    'event_types.title',
  ]) {
    params.append('select', f)
  }
  const res = await NoonaHQ.get<RawBookingEvent[]>(`/${COMPANY_ID}/events?${params.toString()}`)
  return Array.isArray(res.data) ? res.data : []
}


interface RawCustomer {
  id?: string
  name?: string
  email?: string
}
const fetchCustomers = async (): Promise<Map<string, { email: string; name: string }>> => {
  const params = new URLSearchParams()
  for (const f of ['id', 'name', 'email']) params.append('select', f)
  const res = await NoonaHQ.get<RawCustomer[]>(`/${COMPANY_ID}/customers?${params.toString()}`)
  const map = new Map<string, { email: string; name: string }>()
  for (const c of Array.isArray(res.data) ? res.data : []) {
    if (c.id) map.set(c.id, { email: c.email ?? '', name: c.name ?? '' })
  }
  return map
}

interface ServiceMetaD {
  id: string
  title: string
  duration: number // минуты
  hidden: boolean
}

interface CategoryServices {
  title: string // название категории Noona
  services: ServiceMetaD[]
}

// Категории + услуги ВНУТРИ них с длительностью — ОДНИМ запросом.
// `expand=ordered_event_types.event_type` разворачивает полный объект услуги
// (duration/title/connections.hidden подтверждено на проде). Это заменяет отдельную
// загрузку всех ~2400 event_types: в группах только базовые услуги (combo/junior
// вынесены из категорий, s74), а длительность берём прямо отсюда.
const fetchCategoryServices = async (): Promise<CategoryServices[]> => {
  const res = await NoonaHQ.get(
    `/${COMPANY_ID}/event_type_groups?expand[]=ordered_event_types.event_type`,
  )
  const groups: Array<{
    title?: string
    ordered_event_types?: Array<{
      event_type?:
        | { id?: string; title?: string; duration?: number; connections?: { hidden?: boolean } }
        | string
    }>
  }> = Array.isArray(res.data) ? res.data : []

  return groups
    .filter((g) => g.title)
    .map((g) => {
      const services: ServiceMetaD[] = []
      for (const item of g.ordered_event_types ?? []) {
        const et = item?.event_type
        if (!et || typeof et !== 'object' || !et.id) continue
        services.push({
          id: et.id,
          title: et.title ?? '',
          duration: et.duration ?? 0,
          hidden: Boolean(et.connections?.hidden),
        })
      }
      return { title: g.title!, services }
    })
}

// Noona-id юниор-мастеров (Strapi personal.tier=junior) — им дозапись НЕ предлагаем
// (юниоры делают процедуры дольше). Public GET (как masterPriority).
const fetchJuniorEmployeeIds = async (): Promise<Set<string>> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await Axios.get(
      '/api/personals?fields[0]=noonaEmployeeId&filters[tier][$eq]=junior&pagination[pageSize]=100&status=published',
    )
    const arr: Array<{ noonaEmployeeId?: string | null }> = Array.isArray(data) ? data : []
    return new Set(arr.map((p) => p.noonaEmployeeId).filter((id): id is string => Boolean(id)))
  } catch {
    return new Set()
  }
}

// ─── Лог предложений (дедуп) ────────────────────────────────────────────────
export interface WindowOfferLog {
  documentId: string
  bookingEventId: string
  offeredCategory: string
  customerId: string
  customerName: string
  email: string
  masterId: string
  masterName: string
  serviceTitle: string
  anchorDate: string
  windowTime: string
  discount: string
  sentAt: string
}

export const fetchOfferLogs = async (): Promise<WindowOfferLog[]> => {
  const logs: WindowOfferLog[] = []
  let page = 1
  for (;;) {
    const query = qs.stringify(
      {
        fields: [
          'bookingEventId',
          'offeredCategory',
          'customerId',
          'customerName',
          'email',
          'masterId',
          'masterName',
          'serviceTitle',
          'anchorDate',
          'windowTime',
          'discount',
          'sentAt',
        ],
        sort: ['sentAt:desc'],
        pagination: { page, pageSize: 200 },
      },
      { encodeValuesOnly: true },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res: any
    try {
      res = await Axios.get(`/api/window-offer-logs?${query}`)
    } catch {
      // Strapi ещё без коллекции (до деплоя) — не валим экран, просто без дедупа
      break
    }
    const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : []
    for (const l of data) {
      logs.push({
        documentId: String(l.documentId ?? ''),
        bookingEventId: String(l.bookingEventId ?? ''),
        offeredCategory: String(l.offeredCategory ?? ''),
        customerId: String(l.customerId ?? ''),
        customerName: String(l.customerName ?? ''),
        email: String(l.email ?? ''),
        masterId: String(l.masterId ?? ''),
        masterName: String(l.masterName ?? ''),
        serviceTitle: String(l.serviceTitle ?? ''),
        anchorDate: String(l.anchorDate ?? ''),
        windowTime: String(l.windowTime ?? ''),
        discount: String(l.discount ?? ''),
        sentAt: String(l.sentAt ?? ''),
      })
    }
    if (data.length < 200) break
    page++
  }
  return logs
}

// ─── Кандидат ──────────────────────────────────────────────────────────────
// Вариант услуги для выбора (используется в модале «дозапись в окно»)
export interface ServiceOption {
  serviceId: string
  serviceTitle: string
  serviceDurationMin: number
  offerBucket: Bucket
  bookingUrl: string
  isJunior?: boolean // junior-услуга (Nehty - Junior, −20% уже в цене)
}

export interface CrossSellCandidate {
  key: string // = bookingEventId (один кандидат на бронь-якорь)
  bookingEventId: string
  customerId: string
  customerName: string
  email: string
  date: string // 'YYYY-MM-DD' — день брони
  anchorBucket: Bucket
  anchorEndHHMM: string // конец последней процедуры клиента в этот день
  offerBucket: Bucket
  masterId: string
  masterName: string
  windowStartHHMM: string
  windowDurationMin: number
  serviceId: string
  serviceTitle: string
  serviceDurationMin: number
  bookingUrl: string
  alreadySent: boolean
  // Все услуги, влезающие в окно (для ручного выбора в модале «дозапись в окно»).
  // По умолчанию выбран первый (самый длинный). В cross-sell табе не используется.
  serviceOptions?: ServiceOption[]
  // true → предложение junior-услуг (заполнение окна юниора): другое письмо,
  // −20% уже в цене junior + −discount за дозапись. Только в обратном направлении.
  isJunior?: boolean
}

interface OfferOption {
  bucket: Bucket
  master: MasterGapsRow
  windowStart: number // minutes
  windowDurationMin: number
  service: ServiceMetaD
}

const enabledFor = (emp: Employee | undefined, serviceId: string): boolean => {
  if (!emp) return true
  const pref = emp.event_type_preferences.find((p) => p.event_type === serviceId)
  return pref ? !pref.skip_calendar : true
}

// Кэш медленно-меняющихся данных (клиенты, категории, услуги, категории мастеров,
// сотрудники) — 10 мин. Это самые тяжёлые запросы (90-дневная история, ~1700
// клиентов, ~2400 услуг); меняются редко. Повторные заходы на таб мгновенные.
// Кнопка «Обновить» вызывает с force=true → сбрасывает кэш.
interface SlowCache {
  ts: number
  customers: Map<string, { email: string; name: string }>
  catServices: CategoryServices[]
  employees: Employee[]
  juniorIds: Set<string>
}
let slowCache: SlowCache | null = null
const SLOW_TTL = 10 * 60 * 1000

const minToHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Загрузка медленно-меняющихся данных (кэш 10 мин)
const ensureSlow = async (force: boolean): Promise<SlowCache> => {
  if (force || !slowCache || Date.now() - slowCache.ts > SLOW_TTL) {
    const [customers, catServices, employees, juniorIds] = await Promise.all([
      fetchCustomers(),
      fetchCategoryServices(),
      fetchEmployees(),
      fetchJuniorEmployeeIds(),
    ])
    slowCache = { ts: Date.now(), customers, catServices, employees, juniorIds }
  }
  return slowCache
}

interface Derived {
  bucketServices: Map<Bucket, ServiceMetaD[]>
  empBuckets: Map<string, Set<Bucket>>
  empById: Map<string, Employee>
  // id услуги → категория (для надёжной классификации БРОНЕЙ: многие брови-услуги
  // не содержат «obočí» в названии — «Laminace», «Úprava tvaru» — но лежат в брови-категории)
  serviceBucket: Map<string, Bucket>
  // junior-услуги (Nehty - Junior, −20% уже в цене). Предлагаются ТОЛЬКО при
  // заполнении окон самих юниоров (обратное направление), в senior-пул не идут.
  juniorServices: ServiceMetaD[]
}
// Услуги по категориям + категории каждого мастера (из назначенных услуг) — чисто
const buildDerived = (slow: SlowCache): Derived => {
  const bucketServices = new Map<Bucket, ServiceMetaD[]>()
  const serviceBucket = new Map<string, Bucket>()
  const juniorServices: ServiceMetaD[] = []
  for (const cat of slow.catServices) {
    const b = classifyTitle(cat.title)
    if (!b) continue
    // junior-категория (Nehty - Junior): в serviceBucket держим (чтобы junior-бронь
    // считалась «маникюр»), в bucketServices НЕ кладём, а собираем в juniorServices.
    const isJuniorCat = cat.title.toLowerCase().includes('junior')
    const list = bucketServices.get(b) ?? []
    for (const meta of cat.services) {
      // serviceBucket — ВСЕ услуги категории (даже скрытые/снятия/junior), для классификации броней
      if (!serviceBucket.has(meta.id)) serviceBucket.set(meta.id, b)
      // только то, что МОЖНО предложить (базовое, не скрытое, с длительностью)
      if (meta.hidden || meta.duration <= 0 || isExcludedOfferService(meta.title)) continue
      if (isJuniorCat) {
        if (!juniorServices.some((s) => s.id === meta.id)) juniorServices.push(meta)
        continue
      }
      if (!list.some((s) => s.id === meta.id)) list.push(meta)
    }
    bucketServices.set(b, list)
  }
  const empBuckets = new Map<string, Set<Bucket>>()
  for (const emp of slow.employees) {
    const set = new Set<Bucket>()
    for (const C of ALL_BUCKETS) {
      const svcs = bucketServices.get(C) ?? []
      if (svcs.some((s) => enabledFor(emp, s.id))) set.add(C)
    }
    if (set.size) empBuckets.set(emp.id, set)
  }
  return {
    bucketServices,
    empBuckets,
    empById: new Map(slow.employees.map((e) => [e.id, e])),
    serviceBucket,
    juniorServices,
  }
}

// Классификатор брони: сначала по id услуги (надёжно — брови-комбо в брови-категории),
// фолбэк — по названию (для nail-комбо, которых нет в категориях после s74).
const classifierFrom =
  (serviceBucket: Map<string, Bucket>) =>
  (e: RawBookingEvent): Bucket | null =>
    serviceBucket.get(e.event_types?.[0]?.id ?? '') ??
    classifyTitle(e.event_types?.[0]?.title ?? '')

interface DayBooking {
  eventId: string
  bucket: Bucket
  endMin: number
}
// Брони по ключу клиент|день (только активные, классифицируемые)
const groupByClientDay = (
  events: RawBookingEvent[],
  classify: (e: RawBookingEvent) => Bucket | null,
  allowDays?: Set<string>,
): Map<string, { date: string; customerId: string; bookings: DayBooking[] }> => {
  const map = new Map<string, { date: string; customerId: string; bookings: DayBooking[] }>()
  for (const e of events) {
    if (!e.customer || !e.event_date) continue
    if (allowDays && !allowDays.has(e.event_date)) continue
    if (e.status === 'cancelled') continue
    if (!e.starts_at || !e.ends_at) continue
    const bucket = classify(e)
    if (!bucket) continue
    const k = `${e.customer}|${e.event_date}`
    let grp = map.get(k)
    if (!grp) {
      grp = { date: e.event_date, customerId: e.customer, bookings: [] }
      map.set(k, grp)
    }
    grp.bookings.push({ eventId: e.id ?? '', bucket, endMin: isoToMin(e.ends_at) })
  }
  return map
}

export const getWindowCrossSellCandidates = async (
  force = false,
): Promise<CrossSellCandidate[]> => {
  const today = new Date()
  const d1 = dateToStr(addDays(today, 1)) // завтра
  const d2 = dateToStr(addDays(today, 2)) // послезавтра
  const days = new Set([d1, d2])

  // Медленно-меняющиеся данные (кэш) + дешёвые свежие (2-дневные окна + Strapi-лог)
  const slow = await ensureSlow(force)
  const { customers, juniorIds } = slow
  const { bucketServices, empBuckets, empById, serviceBucket } = buildDerived(slow)

  const [bookings, gaps, logs] = await Promise.all([
    fetchDayBookings(d1, d2),
    getScheduleGaps(d1, d2),
    fetchOfferLogs(),
  ])
  const sentSet = new Set(logs.map((l) => l.bookingEventId))

  const byClientDay = groupByClientDay(bookings, classifierFrom(serviceBucket), days)
  const candidates: CrossSellCandidate[] = []

  for (const grp of byClientDay.values()) {
    const customerId = grp.customerId
    const contact = customers.get(customerId)
    if (!contact?.email) continue // без email не предлагаем

    // Якорь = последняя бронь дня (по концу)
    const anchor = grp.bookings.reduce((a, b) => (b.endMin > a.endMin ? b : a))
    if (!anchor.eventId) continue
    const bookedBuckets = new Set(grp.bookings.map((b) => b.bucket))

    // Перебираем недостающие категории → лучшее окно/мастер/услуга
    const options: OfferOption[] = []
    for (const C of ALL_BUCKETS) {
      if (bookedBuckets.has(C)) continue
      const services = bucketServices.get(C) ?? []
      if (!services.length) continue
      for (const master of gaps) {
        if (juniorIds.has(master.employeeId)) continue // юниорам дозапись не предлагаем
        if (!empBuckets.get(master.employeeId)?.has(C)) continue
        const dayGaps = master.days.find((dd) => dd.date === grp.date)
        if (!dayGaps) continue
        for (const g of dayGaps.gaps) {
          const gStart = hhmmToMin(g.start)
          const gEnd = hhmmToMin(g.end)
          // Дозапись началась бы сразу после её процедуры. Если окно мастера уже
          // открыто к этому моменту — старт ровно в конец процедуры (без ожидания);
          // если окно открывается чуть позже — старт в начале окна.
          const slotStart = Math.max(gStart, anchor.endMin)
          // Мастер должен быть свободен ~сразу после процедуры (ожидание ≤15 мин).
          // ВАЖНО: окно может ОТКРЫТЬСЯ РАНЬШЕ (свободен весь день) — это валидно,
          // клиент приходит в slotStart внутри большого окна.
          if (slotStart > anchor.endMin + WINDOW_TOLERANCE_MIN) continue
          const avail = gEnd - slotStart // доступно времени с момента дозаписи
          if (avail <= 0) continue
          // короткая услуга (≤MAX_OFFER_SERVICE_MIN), влезающая в доступное время и
          // доступная мастеру; берём самую длинную из подходящих
          const cap = Math.min(avail, MAX_OFFER_SERVICE_MIN)
          const fitting = services
            .filter((s) => s.duration <= cap && enabledFor(empById.get(master.employeeId), s.id))
            .sort((a, b) => b.duration - a.duration)
          if (!fitting.length) continue
          options.push({
            bucket: C,
            master,
            windowStart: slotStart,
            windowDurationMin: avail,
            service: fitting[0],
          })
        }
      }
    }
    if (!options.length) continue

    // Лучшая: окно стартует раньше (быстрее после процедуры) → длиннее услуга
    options.sort(
      (a, b) =>
        a.windowStart - b.windowStart || b.service.duration - a.service.duration,
    )
    const best = options[0]
    const startHHMM = `${String(Math.floor(best.windowStart / 60)).padStart(2, '0')}:${String(
      best.windowStart % 60,
    ).padStart(2, '0')}`

    candidates.push({
      key: anchor.eventId,
      bookingEventId: anchor.eventId,
      customerId,
      customerName: contact.name || '—',
      email: contact.email,
      date: grp.date,
      anchorBucket: anchor.bucket,
      anchorEndHHMM: `${String(Math.floor(anchor.endMin / 60)).padStart(2, '0')}:${String(
        anchor.endMin % 60,
      ).padStart(2, '0')}`,
      offerBucket: best.bucket,
      masterId: best.master.employeeId,
      masterName: best.master.name,
      windowStartHHMM: startHHMM,
      windowDurationMin: best.windowDurationMin,
      serviceId: best.service.id,
      serviceTitle: best.service.title,
      serviceDurationMin: best.service.duration,
      bookingUrl: `${CLIENT_URL}/book/${best.service.id}/${best.master.employeeId}`,
      alreadySent: sentSet.has(anchor.eventId),
    })
  }

  // Сортировка: новые (не отправленные) сверху, затем по дате/времени
  candidates.sort((a, b) => {
    if (a.alreadySent !== b.alreadySent) return a.alreadySent ? 1 : -1
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return a.windowStartHHMM < b.windowStartHHMM ? -1 : 1
  })
  return candidates
}

// ─── Обратное направление: клик по конкретному окну → кандидаты на дозапись ────
// Окно ФИКСИРОВАНО (мастер + день + интервал). Ищем клиентов, чья процедура
// заканчивается прямо перед этим окном (ожидание ≤15 мин), и подбираем услугу
// мастера, влезающую в окно (≤MAX_OFFER_SERVICE_MIN). Отправка — sendCrossSellOffers.
export const getWindowFillCandidates = async (
  employeeId: string,
  employeeName: string,
  date: string,
  gapStartHHMM: string,
  gapEndHHMM: string,
): Promise<CrossSellCandidate[]> => {
  const slow = await ensureSlow(false)
  const isJunior = slow.juniorIds.has(employeeId)
  const { bucketServices, empBuckets, empById, serviceBucket, juniorServices } = buildDerived(slow)
  const emp = empById.get(employeeId)

  // senior — обязательны категории мастера; junior — предлагаем junior-ногти (manicure)
  let masterCats: Set<Bucket> | null = null
  if (isJunior) {
    if (juniorServices.length === 0) return [] // нечего предложить
  } else {
    masterCats = empBuckets.get(employeeId) ?? null
    if (!masterCats || masterCats.size === 0) return []
  }

  const [bookings, logs] = await Promise.all([fetchDayBookings(date, date), fetchOfferLogs()])
  const sentSet = new Set(logs.map((l) => l.bookingEventId))
  const byClientDay = groupByClientDay(bookings, classifierFrom(serviceBucket), new Set([date]))

  const gapStart = hhmmToMin(gapStartHHMM)
  const gapEnd = hhmmToMin(gapEndHHMM)

  const candidates: CrossSellCandidate[] = []
  for (const grp of byClientDay.values()) {
    const contact = slow.customers.get(grp.customerId)
    if (!contact?.email) continue
    const anchor = grp.bookings.reduce((a, b) => (b.endMin > a.endMin ? b : a))
    if (!anchor.eventId) continue
    const bookedBuckets = new Set(grp.bookings.map((b) => b.bucket))

    // Клиент должен быть свободен ~сразу когда открывается окно (ожидание ≤15 мин)
    const slotStart = Math.max(gapStart, anchor.endMin)
    if (slotStart > anchor.endMin + WINDOW_TOLERANCE_MIN) continue
    const avail = gapEnd - slotStart
    if (avail <= 0) continue

    // ВСЕ услуги, влезающие в окно
    const opts: ServiceOption[] = []
    if (isJunior) {
      // junior-ногти — только тем, кто в этот день НЕ записан на маникюр.
      // Лимит длительности = окно (без MAX_OFFER: junior-процедура длиннее senior).
      if (!bookedBuckets.has('manicure')) {
        for (const s of juniorServices) {
          if (s.duration <= avail && enabledFor(emp, s.id)) {
            opts.push({
              serviceId: s.id,
              serviceTitle: s.title,
              serviceDurationMin: s.duration,
              offerBucket: 'manicure',
              bookingUrl: `${CLIENT_URL}/book/${s.id}/${employeeId}`,
              isJunior: true,
            })
          }
        }
      }
    } else {
      // среди категорий мастера (клиент ещё не записан в них), короткие услуги ≤60 мин
      const cap = Math.min(avail, MAX_OFFER_SERVICE_MIN)
      for (const C of masterCats!) {
        if (bookedBuckets.has(C)) continue
        for (const s of bucketServices.get(C) ?? []) {
          if (s.duration <= cap && enabledFor(emp, s.id)) {
            opts.push({
              serviceId: s.id,
              serviceTitle: s.title,
              serviceDurationMin: s.duration,
              offerBucket: C,
              bookingUrl: `${CLIENT_URL}/book/${s.id}/${employeeId}`,
            })
          }
        }
      }
    }
    if (!opts.length) continue
    // дефолт — самая длинная влезающая услуга
    opts.sort((a, b) => b.serviceDurationMin - a.serviceDurationMin)
    const best = opts[0]

    candidates.push({
      key: anchor.eventId,
      bookingEventId: anchor.eventId,
      customerId: grp.customerId,
      customerName: contact.name || '—',
      email: contact.email,
      date: grp.date,
      anchorBucket: anchor.bucket,
      anchorEndHHMM: minToHHMM(anchor.endMin),
      offerBucket: best.offerBucket,
      masterId: employeeId,
      masterName: employeeName,
      windowStartHHMM: minToHHMM(slotStart),
      windowDurationMin: avail,
      serviceId: best.serviceId,
      serviceTitle: best.serviceTitle,
      serviceDurationMin: best.serviceDurationMin,
      bookingUrl: best.bookingUrl,
      alreadySent: sentSet.has(anchor.eventId),
      serviceOptions: opts,
      isJunior,
    })
  }
  candidates.sort((a, b) =>
    a.alreadySent !== b.alreadySent
      ? a.alreadySent
        ? 1
        : -1
      : a.customerName.localeCompare(b.customerName, 'cs'),
  )
  return candidates
}

// ─── Отправка + лог ───────────────────────────────────────────────────────────
export interface SendResult {
  total: number
  successful: number
  failed: number
}

const TEMPLATE = 'window-cross-sell'
const TEMPLATE_JUNIOR = 'window-cross-sell-junior'
const SUBJECT = 'Hned po vaší návštěvě máme volný termín — se slevou 💕'
const SUBJECT_JUNIOR = 'Zkuste nehty u naší junior mistrové — výhodně 💅'

// Параметры атрибуции в ссылку: src=win (метка письма), disc (числом), d (дата →
// клиент сразу попадает на нужный день). На клиенте src/disc сохраняются в
// localStorage и попадают в комментарий брони Noona.
const offerUrl = (c: CrossSellCandidate, discount: string): string => {
  const discNum = discount.match(/\d+/)?.[0] ?? ''
  return `${c.bookingUrl}?src=win&d=${c.date}${discNum ? `&disc=${discNum}` : ''}`
}

// Один батч писем (один шаблон). Возвращает счётчики Resend.
const postBulk = async (
  template: string,
  subject: string,
  cands: CrossSellCandidate[],
  discount: string,
): Promise<{ total: number; successful: number; failed: number }> => {
  const res = await fetch(`${CLIENT_URL}/api/send-bulk-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template,
      subject,
      recipients: cands.map((c) => ({
        email: c.email,
        variables: {
          name: c.customerName,
          anchorLabel: BUCKET_LABEL_CS[c.anchorBucket],
          date: fmtCsDate(c.date),
          time: c.windowStartHHMM,
          service: c.serviceTitle,
          master: c.masterName,
          discount,
          bookingUrl: offerUrl(c, discount),
        },
      })),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Send failed')
  return { total: data.total ?? 0, successful: data.successful ?? 0, failed: data.failed ?? 0 }
}

export const sendCrossSellOffers = async (
  cands: CrossSellCandidate[],
  discount: string,
): Promise<SendResult> => {
  if (!cands.length) return { total: 0, successful: 0, failed: 0 }

  // Junior получают ДРУГОЕ письмо (−20% уже в цене + −discount за дозапись).
  const senior = cands.filter((c) => !c.isJunior)
  const junior = cands.filter((c) => c.isJunior)
  const parts = await Promise.all([
    senior.length ? postBulk(TEMPLATE, SUBJECT, senior, discount) : Promise.resolve(null),
    junior.length
      ? postBulk(TEMPLATE_JUNIOR, SUBJECT_JUNIOR, junior, discount)
      : Promise.resolve(null),
  ])
  const agg: SendResult = { total: 0, successful: 0, failed: 0 }
  for (const p of parts) {
    if (!p) continue
    agg.total += p.total
    agg.successful += p.successful
    agg.failed += p.failed
  }

  // Лог по каждому отправленному предложению (дедуп по bookingEventId)
  const sentAt = new Date().toISOString()
  await Promise.all(
    cands.map((c) =>
      Axios.post('/api/window-offer-logs', {
        data: {
          bookingEventId: c.bookingEventId,
          offeredCategory: c.isJunior ? 'manicure-junior' : c.offerBucket,
          customerId: c.customerId,
          customerName: c.customerName,
          email: c.email,
          masterId: c.masterId,
          masterName: c.masterName,
          serviceId: c.serviceId,
          serviceTitle: c.serviceTitle,
          anchorDate: c.date,
          windowTime: c.windowStartHHMM,
          discount,
          sentAt,
        },
      }).catch(() => null),
    ),
  )

  return agg
}

// ─── Статистика: кто записался после отправленного предложения ─────────────────
// Конверсия = у клиента из лога есть АКТИВНАЯ бронь к предложенному мастеру в день
// оффера (anchorDate) или позже. Точная отметка факта — в комментарии брони Noona;
// здесь — приблизительный матчинг по истории событий (как в win-back).
export interface OfferResult {
  log: WindowOfferLog
  converted: boolean
  bookingDate: string | null
}
export interface OfferResultsSummary {
  rows: OfferResult[]
  sent: number
  converted: number
  pct: number
}

export const getOfferResults = async (): Promise<OfferResultsSummary> => {
  const [logs, events] = await Promise.all([fetchOfferLogs(), getEventsHistory()])
  const byCustomer = new Map<string, Array<{ employee: string; date: string }>>()
  for (const e of events) {
    if (!e.customer || !isActive(e)) continue
    let arr = byCustomer.get(e.customer)
    if (!arr) {
      arr = []
      byCustomer.set(e.customer, arr)
    }
    arr.push({ employee: e.employee, date: e.date })
  }

  const rows: OfferResult[] = logs.map((log) => {
    const sentDay = (log.sentAt || '').slice(0, 10)
    const since = log.anchorDate || sentDay
    const hit = (byCustomer.get(log.customerId) ?? [])
      .filter((e) => e.employee === log.masterId && e.date >= since)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    return { log, converted: Boolean(hit), bookingDate: hit?.date ?? null }
  })
  // новые сверху
  rows.sort((a, b) => (a.log.sentAt < b.log.sentAt ? 1 : -1))
  const converted = rows.filter((r) => r.converted).length
  return {
    rows,
    sent: rows.length,
    converted,
    pct: rows.length ? Math.round((converted / rows.length) * 100) : 0,
  }
}
