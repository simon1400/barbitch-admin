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
const normalizeTitle = (t: string) =>
  normalize(t)
    .replace(/^юниор\s+/, '')
    .replace(/\s*\+\s*/g, ' + ')

export type OfferMatchStatus = 'match' | 'mismatch' | 'missing' | 'no-offer'

export interface OfferMatch {
  status: OfferMatchStatus
  strapiTitle: string
  calendarTitle: string
}

// Map keyed by the service-provided item object itself (rows get re-sorted in
// render, so index keys would drift). Each calendar booking is consumed at most
// once — a client with two visits that day matches each record to its own
// booking instead of double-counting one.
export const buildOfferMatches = (items: any[], events: any[]): Map<any, OfferMatch> => {
  const buckets = new Map<string, { title: string; used: boolean }[]>()
  for (const e of events) {
    const key = normalize(e.customer_name || '')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push({ title: e.event_types?.[0]?.title || '', used: false })
  }

  const result = new Map<any, OfferMatch>()
  for (const item of items) {
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

// Per-shift discrepancy list shown in ComparisonCard. Computed by client-name
// matching ALWAYS (not gated on count equality) — a wrong/typo'd client name keeps
// the head-count equal (one extra of name A offsets one missing of name B) yet is a
// real mismatch. Internal worker-to-worker services are dropped (never in calendar).
// Returns null only when every record lines up by name.
export const getDiff = (result: ShiftCheckResult) => {
  const strapiItems = result.serviceProvided.items.filter((i: any) => !i?.internal)
  const { strapiExtra, calendarExtra } = diffByName(strapiItems, result.calendar.events)
  if (strapiExtra.length === 0 && calendarExtra.length === 0) return null
  return { strapiExtra, calendarExtra }
}
