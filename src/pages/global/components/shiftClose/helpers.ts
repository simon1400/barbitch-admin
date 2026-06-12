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

// --- Offer ↔ Noona service title matching -----------------------------------
// Per service-provided row: does the connected Strapi offer match the service
// of this client's Noona event? Titles are synced 1:1 (offerings = Noona
// titles, s65), so a normalized exact compare is the right check.

// Junior offerings are titled "Юниор <senior title>" while the Noona event
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
  noonaTitle: string
}

// Map keyed by the service-provided item object itself (rows get re-sorted in
// render, so index keys would drift). Each Noona event is consumed at most
// once — a client with two visits that day matches each record to its own
// event instead of double-counting one.
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
      result.set(item, { status: 'no-offer', strapiTitle: '', noonaTitle: '' })
      continue
    }
    const bucket = buckets.get(normalize(item.clientName || '')) || []
    if (bucket.length === 0) {
      result.set(item, { status: 'missing', strapiTitle, noonaTitle: '' })
      continue
    }
    const want = normalizeTitle(strapiTitle)
    const hit = bucket.find((b) => !b.used && normalizeTitle(b.title) === want)
    if (hit) {
      hit.used = true
      result.set(item, { status: 'match', strapiTitle, noonaTitle: hit.title })
      continue
    }
    const fallback = bucket.find((b) => !b.used) || bucket[0]
    fallback.used = true
    result.set(item, { status: 'mismatch', strapiTitle, noonaTitle: fallback.title })
  }
  return result
}

export const getDiff = (result: ShiftCheckResult) => {
  if (result.comparison.match) return null

  const noonaNames = result.noona.events.map((e: any) =>
    normalize(e.customer_name || ''),
  )
  const strapiNames = result.serviceProvided.items.map((i: any) =>
    normalize(i.clientName || ''),
  )

  const noonaCount = new Map<string, number>()
  noonaNames.forEach((n) => noonaCount.set(n, (noonaCount.get(n) || 0) + 1))

  const strapiCount = new Map<string, number>()
  strapiNames.forEach((n) => strapiCount.set(n, (strapiCount.get(n) || 0) + 1))

  const onlyInStrapi: string[] = []
  strapiCount.forEach((count, name) => {
    const diff = count - (noonaCount.get(name) || 0)
    for (let i = 0; i < diff; i++) onlyInStrapi.push(name)
  })

  const onlyInNoona: string[] = []
  noonaCount.forEach((count, name) => {
    const diff = count - (strapiCount.get(name) || 0)
    for (let i = 0; i < diff; i++) onlyInNoona.push(name)
  })

  const usedStrapiIdx = new Set<number>()
  const strapiExtra = onlyInStrapi
    .map((normName) => {
      const idx = result.serviceProvided.items.findIndex(
        (i: any, idx: number) =>
          !usedStrapiIdx.has(idx) && normalize(i.clientName || '') === normName,
      )
      if (idx >= 0) {
        usedStrapiIdx.add(idx)
        return result.serviceProvided.items[idx]
      }
      return null
    })
    .filter(Boolean)

  const usedNoonaIdx = new Set<number>()
  const noonaExtra = onlyInNoona
    .map((normName) => {
      const idx = result.noona.events.findIndex(
        (e: any, idx: number) =>
          !usedNoonaIdx.has(idx) &&
          normalize(e.customer_name || '') === normName,
      )
      if (idx >= 0) {
        usedNoonaIdx.add(idx)
        return result.noona.events[idx]
      }
      return null
    })
    .filter(Boolean)

  return { strapiExtra, noonaExtra }
}
