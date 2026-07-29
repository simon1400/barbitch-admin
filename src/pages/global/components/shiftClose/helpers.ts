/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'

export const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })

export const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

export const sortByClientName = <T,>(items: T[], nameKey: string): T[] =>
  [...items].sort((a: any, b: any) =>
    (a[nameKey] || '').localeCompare(b[nameKey] || '', 'cs'),
  )

// --- Offer ↔ calendar service title matching ---------------------------------
// Per service-provided row: does the connected Strapi offer match the service
// of this client's calendar booking? Titles are synced 1:1 (offerings = booking
// service titles, s65), so a normalized exact compare is the right check.

// Junior offerings are titled "Юниор <senior title>" while the booking snapshot
// keeps the plain title — strip the prefix. Also unify spacing around "+"
// (historic combo titles sometimes glue parts differently).
export const normalizeTitle = (t: string) =>
  normalize(t)
    .replace(/^юниор\s+/, '')
    .replace(/\s*\+\s*/g, ' + ')

// --- Structural match: service-provided.booking ↔ calendar booking (V3) ------
// Записи чекаута из календаря («Uzavřít návštěvu») несут ЛИНК на бронь →
// матчатся по documentId, а не по имени клиента. Опечатка/переименование
// клиента больше не разъезжает сверку. Имя-матчинг остаётся fallback'ом для
// legacy-записей (~6000 исторических + всё, что заводят вручную в Strapi CM).

/** documentId брони, к которой привязана запись (null у legacy-записей). */
export const bookingDocIdOf = (item: any): string | null => {
  const id = item?.booking?.documentId
  return typeof id === 'string' && id ? id : null
}

/** Название услуги из снапшота брони: «Manikúra + Design» (пусто → ''). */
export const bookingServiceTitle = (booking: any): string =>
  (Array.isArray(booking?.services) ? booking.services : [])
    .map((s: any) => String(s?.title || '').trim())
    .filter(Boolean)
    .join(' + ')

export interface BookingMatchResult {
  /** запись → её бронь (событие календаря) */
  linked: Map<any, any>
  /** записи С линком, чьей брони в списке дня нет (отменена/удалена) */
  unmatchedLinked: any[]
  /** записи БЕЗ линка — идут в имя-матчинг */
  restItems: any[]
  /** брони без привязанной записи — идут в имя-матчинг */
  restEvents: any[]
}

// Каждое событие «съедается» максимум один раз (у клиента с двумя визитами в день
// каждая запись матчится на свою бронь).
export const matchByBooking = (items: any[], events: any[]): BookingMatchResult => {
  const byId = new Map<string, any[]>()
  for (const e of events) {
    const id = e?.id ? String(e.id) : ''
    if (!id) continue
    if (!byId.has(id)) byId.set(id, [])
    byId.get(id)!.push(e)
  }

  const usedEvents = new Set<any>()
  const linked = new Map<any, any>()
  const unmatchedLinked: any[] = []
  const restItems: any[] = []

  for (const item of items) {
    const id = bookingDocIdOf(item)
    if (!id) {
      restItems.push(item)
      continue
    }
    const hit = (byId.get(id) || []).find((e) => !usedEvents.has(e))
    if (hit) {
      usedEvents.add(hit)
      linked.set(item, hit)
    } else {
      // Линк есть, а брони среди активных нет → визит закрыли, бронь потом отменили.
      // В имя-матчинг НЕ отдаём: линк авторитетнее, иначе запись «спрячется» за
      // однофамильцем и реальный сигнал (деньги на отменённой брони) пропадёт.
      unmatchedLinked.push(item)
    }
  }

  return {
    linked,
    unmatchedLinked,
    restItems,
    restEvents: events.filter((e) => !usedEvents.has(e)),
  }
}

export type OfferMatchStatus = 'match' | 'mismatch' | 'missing' | 'no-offer'

export interface OfferMatch {
  status: OfferMatchStatus
  strapiTitle: string
  calendarTitle: string
  /** 'booking' — услуга взята из самой брони (сравнивать нечего) */
  source?: 'booking'
}

// Map keyed by the service-provided item object itself (rows get re-sorted in
// render, so index keys would drift). Each calendar booking is consumed at most
// once — a client with two visits that day matches each record to its own
// booking instead of double-counting one.
export const buildOfferMatches = (items: any[], events: any[]): Map<any, OfferMatch> => {
  const result = new Map<any, OfferMatch>()

  // Записи с линком на бронь: услуга взята ИЗ брони → расхождения быть не может.
  // Их брони выводятся из пула, чтобы legacy-запись однофамильца не сматчилась
  // на чужую (уже использованную) бронь.
  const { linked, unmatchedLinked, restItems, restEvents } = matchByBooking(items, events)
  for (const item of [...linked.keys(), ...unmatchedLinked]) {
    const title = bookingServiceTitle(item.booking)
    result.set(item, {
      status: 'match',
      strapiTitle: title,
      calendarTitle: title,
      source: 'booking',
    })
  }

  const buckets = new Map<string, { title: string; used: boolean }[]>()
  for (const e of restEvents) {
    const key = normalize(e.customer_name || '')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push({ title: e.event_types?.[0]?.title || '', used: false })
  }

  for (const item of restItems) {
    const strapiTitle = item?.offer?.title || ''
    if (!strapiTitle) {
      result.set(item, { status: 'no-offer', strapiTitle: '', calendarTitle: '' })
      continue
    }
    const bucket = buckets.get(normalize(item.clientName || '')) || []
    if (bucket.length === 0) {
      result.set(item, { status: 'missing', strapiTitle, calendarTitle: '' })
      continue
    }
    const want = normalizeTitle(strapiTitle)
    const hit = bucket.find((b) => !b.used && normalizeTitle(b.title) === want)
    if (hit) {
      hit.used = true
      result.set(item, { status: 'match', strapiTitle, calendarTitle: hit.title })
      continue
    }
    const fallback = bucket.find((b) => !b.used) || bucket[0]
    fallback.used = true
    result.set(item, { status: 'mismatch', strapiTitle, calendarTitle: fallback.title })
  }
  return result
}

// Pure client-name multiset diff between Strapi service rows and calendar
// bookings. Returns the records on each side that have no counterpart by name.
// Internal services must be filtered out by the caller (never in the calendar).
export const diffByName = (
  strapiItems: any[],
  calendarEvents: any[],
): { strapiExtra: any[]; calendarExtra: any[] } => {
  const calendarNames = calendarEvents.map((e: any) => normalize(e.customer_name || ''))
  const strapiNames = strapiItems.map((i: any) => normalize(i.clientName || ''))

  const calendarCount = new Map<string, number>()
  calendarNames.forEach((n) => calendarCount.set(n, (calendarCount.get(n) || 0) + 1))

  const strapiCount = new Map<string, number>()
  strapiNames.forEach((n) => strapiCount.set(n, (strapiCount.get(n) || 0) + 1))

  const onlyInStrapi: string[] = []
  strapiCount.forEach((count, name) => {
    const diff = count - (calendarCount.get(name) || 0)
    for (let i = 0; i < diff; i++) onlyInStrapi.push(name)
  })

  const onlyInCalendar: string[] = []
  calendarCount.forEach((count, name) => {
    const diff = count - (strapiCount.get(name) || 0)
    for (let i = 0; i < diff; i++) onlyInCalendar.push(name)
  })

  const usedStrapiIdx = new Set<number>()
  const strapiExtra = onlyInStrapi
    .map((normName) => {
      const idx = strapiItems.findIndex(
        (i: any, idx: number) =>
          !usedStrapiIdx.has(idx) && normalize(i.clientName || '') === normName,
      )
      if (idx >= 0) {
        usedStrapiIdx.add(idx)
        return strapiItems[idx]
      }
      return null
    })
    .filter(Boolean)

  const usedCalendarIdx = new Set<number>()
  const calendarExtra = onlyInCalendar
    .map((normName) => {
      const idx = calendarEvents.findIndex(
        (e: any, idx: number) =>
          !usedCalendarIdx.has(idx) && normalize(e.customer_name || '') === normName,
      )
      if (idx >= 0) {
        usedCalendarIdx.add(idx)
        return calendarEvents[idx]
      }
      return null
    })
    .filter(Boolean)

  return { strapiExtra, calendarExtra }
}

export interface ShiftDiff {
  /** записи без пары: сначала «линк есть, брони нет», затем остаток по именам */
  strapiExtra: any[]
  /** брони без записи */
  calendarExtra: any[]
  /** остаток по ИМЕНАМ есть с обеих сторон → имеет смысл пере-матч имён (s97) */
  nameMismatch: boolean
}

// Расхождения смены. Сначала СТРУКТУРНО (service-provided.booking ↔ бронь), затем
// остаток по именам — это и есть главный профит V3: опечатка в имени legacy-записи
// больше не разъезжает записи, привязанные к броням.
// Матчинг по именам считается ВСЕГДА (не по равенству счётчиков) — неверное имя
// держит счётчик равным (лишний одного имени гасит недостающего другого), но это
// настоящее расхождение. Интерни-услуги участвуют: они тоже бронируются через
// календарь (walk-in + галка «Interní», s145).
export const computeShiftDiff = (items: any[], events: any[]): ShiftDiff => {
  const { unmatchedLinked, restItems, restEvents } = matchByBooking(items, events)
  const byName = diffByName(restItems, restEvents)
  return {
    strapiExtra: [...unmatchedLinked, ...byName.strapiExtra],
    calendarExtra: byName.calendarExtra,
    nameMismatch: byName.strapiExtra.length > 0 && byName.calendarExtra.length > 0,
  }
}

// Per-shift discrepancy list shown in ComparisonCard.
// Returns null only when every record lines up.
export const getDiff = (result: ShiftCheckResult) => {
  const { strapiExtra, calendarExtra } = computeShiftDiff(
    result.serviceProvided.items,
    result.calendar.events,
  )
  if (strapiExtra.length === 0 && calendarExtra.length === 0) return null
  return { strapiExtra, calendarExtra }
}
