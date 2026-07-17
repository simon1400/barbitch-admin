import qs from 'qs'
import { Axios } from '../../../../lib/api'
import {
  clientKey,
  fetchAllPagesStrapi,
  fetchMirrorBookingsRange,
  fetchMirrorClients,
  fetchMirrorEmployees,
} from '../../../../lib/mirror'
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
//
// Фаза 7 (чистка Noona): все данные — НАШИ. Каталог/категории/длительности ←
// salon-service, «мастер делает услугу» ← personal.services (populate personals),
// клиенты+email ← коллекция client, брони дня ← зеркальные bookings (lib/mirror),
// окна ← scheduleGaps (наша БД с s100). Deep-link письма = /book/{serviceDocId}/
// {personalDocId} (движок). Совместимость window-offer-log сохранена: masterId =
// noonaEmployeeId (ключ HistEvent.employee), customerId = clientKey.

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

// Классификация по названию услуги/категории каталога. Покрывает и снапшоты услуг
// в бронях (services[].title). Порядок важен: «řas» (ресницы) проверяем до «obočí»,
// маникюр — последним. ⚠️ При новых категориях каталога — дополнить ключевые слова.
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

// НЕ предлагаем для дозаписи не-базовые услуги: снятия/удаления (Sundání,
// Odstranění) и доливы/коррекции (Doplnění, Korekce — делаются поверх существующей
// работы, не подходят как самостоятельное предложение). Фильтр применяется только
// к ПРЕДЛАГАЕМЫМ услугам, не к классификации текущей брони клиента.
const NON_BASE_KEYWORDS = [
  'sundání',
  'sundani',
  'odstranění',
  'odstraneni',
  'doplnění',
  'doplneni',
  'korekce',
]
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
const minToHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// ─── Каталог: услуги + назначенные мастера (salon-service) ────────────────────
interface CatalogSvc {
  docId: string
  title: string
  bucket: Bucket
  durationMin: number
  masterIds: Set<string> // noonaEmployeeId назначенных мастеров (personal.services)
}

interface RawSalonService {
  documentId: string
  title?: string
  category?: string
  durationMin?: number
  active?: boolean
  onlineBookable?: boolean
  personals?: Array<{ documentId?: string; noonaEmployeeId?: string | null }>
}

// Активные онлайн-услуги каталога с назначенными мастерами. Категория каталога →
// bucket (фолбэк — по названию услуги). populate personals может отдать дубли
// (draft+published строки personal) — masterIds это Set, дубль безвреден.
const fetchOfferableServices = async (): Promise<CatalogSvc[]> => {
  const raw = await fetchAllPagesStrapi<RawSalonService>(
    '/api/salon-services?fields[0]=title&fields[1]=category&fields[2]=durationMin' +
      '&fields[3]=active&fields[4]=onlineBookable&populate[personals][fields][0]=noonaEmployeeId',
    200,
  )
  const out: CatalogSvc[] = []
  for (const s of raw) {
    if (s.active === false || s.onlineBookable === false) continue
    const title = s.title ?? ''
    const durationMin = Number(s.durationMin ?? 0)
    if (!title || durationMin <= 0 || isExcludedOfferService(title)) continue
    const bucket = classifyTitle(s.category ?? '') ?? classifyTitle(title)
    if (!bucket) continue
    const masterIds = new Set<string>()
    for (const p of s.personals ?? []) {
      if (p?.noonaEmployeeId) masterIds.add(p.noonaEmployeeId)
    }
    out.push({ docId: s.documentId, title, bucket, durationMin, masterIds })
  }
  return out
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
  isJunior?: boolean // услуга у junior-мастера (−20% движок применяет сам)
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
  // По умолчанию выбран самый длинный. В cross-sell табе не используется.
  serviceOptions?: ServiceOption[]
  // true → окно junior-мастера: другое письмо (−20% уже в цене + −discount за
  // дозапись). Только в обратном направлении (заполнение окна юниора).
  isJunior?: boolean
}

interface OfferOption {
  bucket: Bucket
  master: MasterGapsRow
  windowStart: number // minutes
  windowDurationMin: number
  service: CatalogSvc
}

// Кэш медленно-меняющихся данных (клиенты, каталог, мастера) — 10 мин.
// Кнопка «Обновить» вызывает с force=true → сбрасывает кэш.
interface SlowCache {
  ts: number
  contacts: Map<string, { email: string; name: string }> // key = clientKey
  services: CatalogSvc[]
  juniorIds: Set<string> // noonaEmployeeId мастеров tier=junior
  empDocIds: Map<string, string> // noonaEmployeeId → personal.documentId (для deep-link)
}
let slowCache: SlowCache | null = null
const SLOW_TTL = 10 * 60 * 1000

const ensureSlow = async (force: boolean): Promise<SlowCache> => {
  if (force || !slowCache || Date.now() - slowCache.ts > SLOW_TTL) {
    const [clients, services, employees] = await Promise.all([
      fetchMirrorClients(),
      fetchOfferableServices(),
      fetchMirrorEmployees(),
    ])
    const contacts = new Map<string, { email: string; name: string }>()
    for (const c of clients) {
      contacts.set(clientKey(c), { email: c.email ?? '', name: c.name ?? '' })
    }
    const juniorIds = new Set<string>()
    const empDocIds = new Map<string, string>()
    for (const e of employees) {
      empDocIds.set(e.id, e.docId)
      if (e.tier === 'junior') juniorIds.add(e.id)
    }
    slowCache = { ts: Date.now(), contacts, services, juniorIds, empDocIds }
  }
  return slowCache
}

interface Derived {
  bucketServices: Map<Bucket, CatalogSvc[]>
  empBuckets: Map<string, Set<Bucket>> // noonaEmployeeId → категории мастера
}
// Услуги по категориям + категории каждого мастера (из назначенных услуг)
const buildDerived = (slow: SlowCache): Derived => {
  const bucketServices = new Map<Bucket, CatalogSvc[]>()
  const empBuckets = new Map<string, Set<Bucket>>()
  for (const svc of slow.services) {
    const list = bucketServices.get(svc.bucket) ?? []
    list.push(svc)
    bucketServices.set(svc.bucket, list)
    for (const empId of svc.masterIds) {
      let set = empBuckets.get(empId)
      if (!set) {
        set = new Set<Bucket>()
        empBuckets.set(empId, set)
      }
      set.add(svc.bucket)
    }
  }
  return { bucketServices, empBuckets }
}

const buildUrl = (slow: SlowCache, svc: CatalogSvc, empNoonaId: string): string | null => {
  const docId = slow.empDocIds.get(empNoonaId)
  return docId ? `${CLIENT_URL}/book/${svc.docId}/${docId}` : null
}

interface DayBooking {
  eventId: string // booking.documentId — ключ дедупа window-offer-log
  buckets: Bucket[]
  endMin: number
}
interface ClientDayGroup {
  date: string
  customerId: string
  bookings: DayBooking[]
}
// Брони по ключу клиент|день (только активные, классифицируемые). Классификация —
// по снапшотам услуг брони (services[].title); бронь может нести несколько услуг
// разных категорий (мульти-бронь движка) — учитываем все.
const groupByClientDay = async (
  fromStr: string,
  toStr: string,
): Promise<Map<string, ClientDayGroup>> => {
  const bookings = await fetchMirrorBookingsRange(fromStr, toStr)
  const map = new Map<string, ClientDayGroup>()
  for (const b of bookings) {
    if (!b.client || !b.date) continue
    if (b.status === 'cancelled') continue
    if (!b.startsAt || !b.endsAt) continue
    const buckets: Bucket[] = []
    for (const s of b.services ?? []) {
      const bucket = classifyTitle(s?.title ?? '')
      if (bucket && !buckets.includes(bucket)) buckets.push(bucket)
    }
    if (!buckets.length) continue
    const customerId = clientKey(b.client)
    const k = `${customerId}|${b.date}`
    let grp = map.get(k)
    if (!grp) {
      grp = { date: String(b.date), customerId, bookings: [] }
      map.set(k, grp)
    }
    grp.bookings.push({ eventId: b.documentId, buckets, endMin: isoToMin(b.endsAt) })
  }
  return map
}

const bookedBucketsOf = (grp: ClientDayGroup): Set<Bucket> => {
  const set = new Set<Bucket>()
  for (const b of grp.bookings) for (const x of b.buckets) set.add(x)
  return set
}

export const getWindowCrossSellCandidates = async (
  force = false,
): Promise<CrossSellCandidate[]> => {
  const today = new Date()
  const d1 = dateToStr(addDays(today, 1)) // завтра
  const d2 = dateToStr(addDays(today, 2)) // послезавтра

  // Медленно-меняющиеся данные (кэш) + дешёвые свежие (2-дневные окна + лог)
  const slow = await ensureSlow(force)
  const { bucketServices, empBuckets } = buildDerived(slow)

  const [byClientDay, gaps, logs] = await Promise.all([
    groupByClientDay(d1, d2),
    getScheduleGaps(d1, d2),
    fetchOfferLogs(),
  ])
  const sentSet = new Set(logs.map((l) => l.bookingEventId))

  const candidates: CrossSellCandidate[] = []

  for (const grp of byClientDay.values()) {
    const contact = slow.contacts.get(grp.customerId)
    if (!contact?.email) continue // без email не предлагаем

    // Якорь = последняя бронь дня (по концу)
    const anchor = grp.bookings.reduce((a, b) => (b.endMin > a.endMin ? b : a))
    if (!anchor.eventId) continue
    const bookedBuckets = bookedBucketsOf(grp)

    // Перебираем недостающие категории → лучшее окно/мастер/услуга
    const options: OfferOption[] = []
    for (const C of ALL_BUCKETS) {
      if (bookedBuckets.has(C)) continue
      const services = bucketServices.get(C) ?? []
      if (!services.length) continue
      for (const master of gaps) {
        if (slow.juniorIds.has(master.employeeId)) continue // юниорам дозапись не предлагаем
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
          // назначенная мастеру; берём самую длинную из подходящих
          const cap = Math.min(avail, MAX_OFFER_SERVICE_MIN)
          const fitting = services
            .filter((s) => s.durationMin <= cap && s.masterIds.has(master.employeeId))
            .sort((a, b) => b.durationMin - a.durationMin)
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
      (a, b) => a.windowStart - b.windowStart || b.service.durationMin - a.service.durationMin,
    )
    const best = options.find((o) => buildUrl(slow, o.service, o.master.employeeId)) ?? null
    if (!best) continue
    const bookingUrl = buildUrl(slow, best.service, best.master.employeeId)!

    candidates.push({
      key: anchor.eventId,
      bookingEventId: anchor.eventId,
      customerId: grp.customerId,
      customerName: contact.name || '—',
      email: contact.email,
      date: grp.date,
      anchorBucket: anchor.buckets[0],
      anchorEndHHMM: minToHHMM(anchor.endMin),
      offerBucket: best.bucket,
      masterId: best.master.employeeId,
      masterName: best.master.name,
      windowStartHHMM: minToHHMM(best.windowStart),
      windowDurationMin: best.windowDurationMin,
      serviceId: best.service.docId,
      serviceTitle: best.service.title,
      serviceDurationMin: best.service.durationMin,
      bookingUrl,
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
// Junior-мастер: та же логика (услуги из personal.services), но письмо другое
// (isJunior) — −20% движок применяет сам, лимит длительности = всё окно.
export const getWindowFillCandidates = async (
  employeeId: string,
  employeeName: string,
  date: string,
  gapStartHHMM: string,
  gapEndHHMM: string,
): Promise<CrossSellCandidate[]> => {
  const slow = await ensureSlow(false)
  const isJunior = slow.juniorIds.has(employeeId)
  const { bucketServices, empBuckets } = buildDerived(slow)

  const masterCats = empBuckets.get(employeeId)
  if (!masterCats || masterCats.size === 0) return []

  const [byClientDay, logs] = await Promise.all([groupByClientDay(date, date), fetchOfferLogs()])
  const sentSet = new Set(logs.map((l) => l.bookingEventId))

  const gapStart = hhmmToMin(gapStartHHMM)
  const gapEnd = hhmmToMin(gapEndHHMM)

  const candidates: CrossSellCandidate[] = []
  for (const grp of byClientDay.values()) {
    const contact = slow.contacts.get(grp.customerId)
    if (!contact?.email) continue
    const anchor = grp.bookings.reduce((a, b) => (b.endMin > a.endMin ? b : a))
    if (!anchor.eventId) continue
    const bookedBuckets = bookedBucketsOf(grp)

    // Клиент должен быть свободен ~сразу когда открывается окно (ожидание ≤15 мин)
    const slotStart = Math.max(gapStart, anchor.endMin)
    if (slotStart > anchor.endMin + WINDOW_TOLERANCE_MIN) continue
    const avail = gapEnd - slotStart
    if (avail <= 0) continue

    // ВСЕ услуги мастера (его категории, клиент в них не записан), влезающие в окно.
    // Junior: лимит = окно целиком (заполнить максимум); senior: короткие ≤60 мин.
    const cap = isJunior ? avail : Math.min(avail, MAX_OFFER_SERVICE_MIN)
    const opts: ServiceOption[] = []
    for (const C of masterCats) {
      if (bookedBuckets.has(C)) continue
      for (const s of bucketServices.get(C) ?? []) {
        if (s.durationMin > cap || !s.masterIds.has(employeeId)) continue
        const url = buildUrl(slow, s, employeeId)
        if (!url) continue
        opts.push({
          serviceId: s.docId,
          serviceTitle: s.title,
          serviceDurationMin: s.durationMin,
          offerBucket: C,
          bookingUrl: url,
          isJunior: isJunior || undefined,
        })
      }
    }
    if (!opts.length) continue
    // Выпадашка — по возрастанию длительности (короче — выше, длиннее — ниже).
    opts.sort((a, b) => a.serviceDurationMin - b.serviceDurationMin)
    // Дефолт — самая длинная влезающая услуга (максимально заполнить окно).
    const best = opts[opts.length - 1]

    candidates.push({
      key: anchor.eventId,
      bookingEventId: anchor.eventId,
      customerId: grp.customerId,
      customerName: contact.name || '—',
      email: contact.email,
      date: grp.date,
      anchorBucket: anchor.buckets[0],
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
// localStorage (bb_offer) и попадают в комментарий брони.
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
          offerLabel: BUCKET_LABEL_CS[c.offerBucket], // категория предложения (manikúra/obočí/řasy)
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
// оффера (anchorDate) или позже, СОЗДАННАЯ после отправки письма. Точная отметка
// факта — в комментарии брони (bb_offer-атрибуция); здесь — приблизительный
// матчинг по истории событий (как в win-back).
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
  const byCustomer = new Map<string, Array<{ employee: string; date: string; createdAt: string }>>()
  for (const e of events) {
    if (!e.customer || !isActive(e)) continue
    let arr = byCustomer.get(e.customer)
    if (!arr) {
      arr = []
      byCustomer.set(e.customer, arr)
    }
    arr.push({ employee: e.employee, date: e.date, createdAt: e.createdAt })
  }

  const rows: OfferResult[] = logs.map((log) => {
    const sentDay = (log.sentAt || '').slice(0, 10)
    const since = log.anchorDate || sentDay
    // Кандидаты на дозапись УЖЕ записаны в этот день → бронь к мастеру могла
    // существовать ДО письма (её исходная запись). Конверсия = НОВАЯ бронь к
    // предложенному мастеру, СОЗДАННАЯ после отправки письма (created_at > sentAt).
    // Без этого пред-существующая бронь давала ложный «записался» (напр. Zuzana
    // Špendel: бронь к Karina на 19.06 создана 31.05, письмо 18.06). Если у брони
    // нет created_at (легаси) — консервативно НЕ засчитываем, чтобы не врать в плюс.
    const sentMs = log.sentAt ? new Date(log.sentAt).getTime() : 0
    const hit = (byCustomer.get(log.customerId) ?? [])
      .filter(
        (e) =>
          e.employee === log.masterId &&
          e.date >= since &&
          Boolean(e.createdAt) &&
          new Date(e.createdAt).getTime() > sentMs,
      )
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
