import {
  clientKey,
  fetchMirrorBookingsRange,
  fetchMirrorClients,
  fetchMirrorEmployees,
} from '../../../../lib/mirror'
import { getScheduleGaps, type MasterGapsRow } from './scheduleGaps'
import { getEventsHistory, isActive } from '../../analytics/fetch/eventsHistory'
import { addDays, hhmmToMin, minToHHMM, todayDate, ymd } from '../../../../utils/date'
import { isActiveStatus } from '../../../../lib/bookingStatus'
import { type Bucket, ALL_BUCKETS, classifyTitle } from './crossSell/buckets'
import { isoToMin } from './crossSell/format'
// 🟥 Публичная поверхность модуля НЕ менялась распилом: вкладки «Дозапись» и
// «Окна» импортируют BUCKET_LABEL и отправку именно отсюда.
export { BUCKET_LABEL } from './crossSell/buckets'
export type { Bucket } from './crossSell/buckets'
import { type CatalogSvc, fetchOfferableServices } from './crossSell/catalog'
import { type WindowOfferLog, fetchOfferLogs } from './crossSell/offerLogs'
export { sendCrossSellOffers, type SendResult } from './crossSell/send'

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


// ─── Кандидат ──────────────────────────────────────────────────────────────
// Вариант услуги для выбора (используется в модале «дозапись в окно»)
interface ServiceOption {
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
      contacts.set(c.customer, { email: c.email ?? '', name: c.name ?? '' })
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
    if (!isActiveStatus(b.status)) continue
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
  // 🟥 `new Date()` здесь означало «сегодня по браузеру». Вечером из пояса
  // западнее Праги «завтра» оказывалось СЕГОДНЯШНИМ днём салона, и клиенту
  // ушло бы предложение на окно, которое уже идёт (s186).
  const today = todayDate()
  const d1 = ymd(addDays(today, 1)) // завтра
  const d2 = ymd(addDays(today, 2)) // послезавтра

  // Медленно-меняющиеся данные (кэш) + дешёвые свежие (2-дневные окна + лог)
  const slow = await ensureSlow(force)
  const { bucketServices, empBuckets } = buildDerived(slow)

  const [byClientDay, gaps, logs] = await Promise.all([
    groupByClientDay(d1, d2),
    getScheduleGaps(d1, d2, force),
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

// ─── Статистика: кто записался после отправленного предложения ─────────────────
// Конверсия = у клиента из лога есть АКТИВНАЯ бронь к предложенному мастеру в день
// оффера (anchorDate) или позже, СОЗДАННАЯ после отправки письма. Точная отметка
// факта — в комментарии брони (bb_offer-атрибуция); здесь — приблизительный
// матчинг по истории событий (как в win-back).
interface OfferResult {
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
