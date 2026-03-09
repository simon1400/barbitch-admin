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
