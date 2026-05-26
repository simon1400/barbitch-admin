import axios from 'axios'
import { NoonaHQ, NoonaHQBase } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1350'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

const StrapiAdmin = axios.create({ baseURL: apiUrl })
StrapiAdmin.interceptors.request.use((config) => {
  if (strapiToken) config.headers.Authorization = `Bearer ${strapiToken}`
  return config
})

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NoonaEventType {
  id: string
  title: string
  hidden: boolean
  price: number
  variations: Array<{
    id?: string
    prices: Array<{ id?: string; amount: number; currency?: string }>
  }>
}

export interface NoonaCategory {
  id: string
  title: string
  serviceIds: string[]
}

export interface StrapiAddonGroup {
  id: number
  documentId: string
  base_noona_id: string
  base_price: number
  title: string
  modifiers: Array<{ id?: number; key: string; label: string; price_diff: number }>
  base_modifier_results: Array<{ id?: number; modifier_keys: string; result_noona_id: string }>
  addons: Array<{
    id?: number
    label: string
    price_diff: number
    result_noona_id: string
    modifier_results?: Array<{ id?: number; modifier_keys: string; result_noona_id: string }>
  }>
}

export interface StrapiOffering {
  id: number
  documentId: string
  title: string
  price: number
}

// A single planned change
export type ChangeKind =
  | 'noona-event-type' // Noona service price
  | 'addon-group' // booking-addon-group: base_price + modifiers[].price_diff + addons[].price_diff
  | 'offering' // Strapi offering.price

export interface PlannedChange {
  key: string // unique id for retry tracking
  kind: ChangeKind
  label: string // human-readable name shown in UI
  before: number
  after: number
  // type-specific payload, used by applyChange()
  payload:
    | { kind: 'noona-event-type'; eventType: NoonaEventType; newAmount: number }
    | {
        kind: 'addon-group'
        documentId: string
        next: {
          base_price: number
          modifiers: Array<{ key: string; label: string; price_diff: number }>
          base_modifier_results: Array<{ modifier_keys: string; result_noona_id: string }>
          addons: Array<{
            label: string
            price_diff: number
            result_noona_id: string
            modifier_results: Array<{ modifier_keys: string; result_noona_id: string }>
          }>
        }
        // for label display
        beforeSummary: string
        afterSummary: string
      }
    | { kind: 'offering'; documentId: string; newPrice: number }
}

export interface ApplyResult {
  change: PlannedChange
  status: 'ok' | 'error'
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getErr = (err: unknown): string => {
  const e = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string }
  return (
    e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Неизвестная ошибка'
  )
}

const scaleInt = (value: number, percent: number): number => Math.round(value * (1 + percent / 100))

// ─── Bulk fetch ──────────────────────────────────────────────────────────────

export const fetchAllNoonaEventTypes = async (): Promise<NoonaEventType[]> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/event_types?expand[]=variations.prices`)
  const items: Array<{
    id?: string
    title?: string
    connections?: { hidden?: boolean }
    variations?: Array<{
      id?: string
      prices?: Array<{ id?: string; amount?: number; currency?: string }>
    }>
  }> = Array.isArray(res.data) ? res.data : []

  return items
    .filter((s) => s.id && Array.isArray(s.variations) && s.variations.length > 0)
    .map((s) => {
      const variations = (s.variations ?? []).map((v) => ({
        id: v.id,
        prices: (v.prices ?? []).map((p) => ({
          id: p.id,
          amount: p.amount ?? 0,
          currency: p.currency ?? 'CZK',
        })),
      }))
      const firstPrice = variations[0]?.prices[0]?.amount ?? 0
      return {
        id: s.id!,
        title: s.title ?? '(без названия)',
        hidden: Boolean(s.connections?.hidden),
        price: firstPrice,
        variations,
      }
    })
}

export const fetchAllNoonaCategoriesWithServices = async (): Promise<NoonaCategory[]> => {
  const res = await NoonaHQ.get(
    `/${COMPANY_ID}/event_type_groups?expand[]=ordered_event_types.event_type`,
  )
  const groups: Array<{
    id?: string
    title?: string
    ordered_event_types?: Array<{ event_type?: { id?: string } | string; id?: string }>
  }> = Array.isArray(res.data) ? res.data : []

  return groups
    .filter((g) => g.id && g.title)
    .map((g) => {
      const serviceIds = (g.ordered_event_types ?? [])
        .map((item) => {
          if (typeof item === 'string') return item
          const et = item.event_type
          return (typeof et === 'object' ? et?.id : et) ?? item.id ?? ''
        })
        .filter((id): id is string => Boolean(id))
      return { id: g.id!, title: g.title!, serviceIds }
    })
}

export const fetchAllAddonGroups = async (): Promise<StrapiAddonGroup[]> => {
  const populate =
    'populate[modifiers]=true' +
    '&populate[base_modifier_results]=true' +
    '&populate[addons][populate][modifier_results]=true'
  const res = await StrapiAdmin.get(`/api/booking-addon-groups?${populate}&pagination[pageSize]=500`)
  const data = res.data?.data ?? []
  return data as StrapiAddonGroup[]
}

export const fetchAllOfferings = async (): Promise<StrapiOffering[]> => {
  // paginate through everything (Strapi default page size = 25)
  const all: StrapiOffering[] = []
  let page = 1
  while (true) {
    const res = await StrapiAdmin.get(
      `/api/offerings?fields[0]=title&fields[1]=price&pagination[page]=${page}&pagination[pageSize]=100`,
    )
    const data = res.data?.data ?? []
    const meta = res.data?.meta?.pagination
    all.push(...(data as StrapiOffering[]))
    if (!meta || page >= meta.pageCount || data.length === 0) break
    page++
  }
  return all
}

// ─── Plan builder ────────────────────────────────────────────────────────────

export type Scope =
  | { kind: 'service'; baseNoonaId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'global' }

export interface BuildPlanInput {
  scope: Scope
  percent: number
  eventTypes: NoonaEventType[]
  categories: NoonaCategory[]
  addonGroups: StrapiAddonGroup[]
  offerings: StrapiOffering[]
}

/**
 * Builds a flat list of all PlannedChange items that will be applied.
 * No network calls — works on the pre-fetched data.
 */
export const buildPlan = ({
  scope,
  percent,
  eventTypes,
  categories,
  addonGroups,
  offerings,
}: BuildPlanInput): PlannedChange[] => {
  if (percent === 0) return []

  // 1. Determine which Noona event_type IDs are in scope
  const inScope = new Set<string>()
  if (scope.kind === 'global') {
    for (const et of eventTypes) inScope.add(et.id)
  } else if (scope.kind === 'category') {
    const cat = categories.find((c) => c.id === scope.categoryId)
    if (cat) for (const id of cat.serviceIds) inScope.add(id)
  } else if (scope.kind === 'service') {
    // base service + ALL combo IDs from its addon-group (if any)
    inScope.add(scope.baseNoonaId)
    const ag = addonGroups.find((g) => g.base_noona_id === scope.baseNoonaId)
    if (ag) {
      for (const a of ag.addons) {
        inScope.add(a.result_noona_id)
        for (const mr of a.modifier_results ?? []) inScope.add(mr.result_noona_id)
      }
      for (const bmr of ag.base_modifier_results) inScope.add(bmr.result_noona_id)
    }
  }

  const changes: PlannedChange[] = []

  // 2. Noona event_type price updates
  const etById = new Map(eventTypes.map((et) => [et.id, et]))
  for (const id of inScope) {
    const et = etById.get(id)
    if (!et) continue
    const newAmount = scaleInt(et.price, percent)
    if (newAmount === et.price) continue
    changes.push({
      key: `noona:${et.id}`,
      kind: 'noona-event-type',
      label: et.title + (et.hidden ? '  (hidden combo)' : ''),
      before: et.price,
      after: newAmount,
      payload: { kind: 'noona-event-type', eventType: et, newAmount },
    })
  }

  // 3. Strapi addon-group updates — whenever the BASE service is in scope
  for (const ag of addonGroups) {
    if (!inScope.has(ag.base_noona_id)) continue
    const newBasePrice = scaleInt(ag.base_price, percent)
    const newModifiers = ag.modifiers.map((m) => ({
      key: m.key,
      label: m.label,
      price_diff: scaleInt(m.price_diff, percent),
    }))
    const newAddons = ag.addons.map((a) => ({
      label: a.label,
      price_diff: scaleInt(a.price_diff, percent),
      result_noona_id: a.result_noona_id,
      modifier_results: (a.modifier_results ?? []).map((r) => ({
        modifier_keys: r.modifier_keys,
        result_noona_id: r.result_noona_id,
      })),
    }))
    const newBmr = ag.base_modifier_results.map((r) => ({
      modifier_keys: r.modifier_keys,
      result_noona_id: r.result_noona_id,
    }))

    // Build short before/after summaries
    const beforeSummary = `base ${ag.base_price} · addons [${ag.addons
      .map((a) => `${a.label}+${a.price_diff}`)
      .join(', ')}] · mods [${ag.modifiers.map((m) => `${m.label}+${m.price_diff}`).join(', ')}]`
    const afterSummary = `base ${newBasePrice} · addons [${newAddons
      .map((a) => `${a.label}+${a.price_diff}`)
      .join(', ')}] · mods [${newModifiers.map((m) => `${m.label}+${m.price_diff}`).join(', ')}]`

    const noChange =
      newBasePrice === ag.base_price &&
      newModifiers.every((m, i) => m.price_diff === ag.modifiers[i].price_diff) &&
      newAddons.every((a, i) => a.price_diff === ag.addons[i].price_diff)
    if (noChange) continue

    changes.push({
      key: `addon-group:${ag.documentId}`,
      kind: 'addon-group',
      label: `Addon-group: ${ag.title}`,
      before: ag.base_price,
      after: newBasePrice,
      payload: {
        kind: 'addon-group',
        documentId: ag.documentId,
        next: {
          base_price: newBasePrice,
          modifiers: newModifiers,
          base_modifier_results: newBmr,
          addons: newAddons,
        },
        beforeSummary,
        afterSummary,
      },
    })
  }

  // 4. Offerings — match by title with Noona services that are in scope
  const titleToOffering = new Map<string, StrapiOffering>()
  for (const o of offerings) titleToOffering.set(o.title, o)

  for (const id of inScope) {
    const et = etById.get(id)
    if (!et) continue
    const offering = titleToOffering.get(et.title)
    if (!offering) continue
    const newPrice = scaleInt(offering.price, percent)
    if (newPrice === offering.price) continue
    changes.push({
      key: `offering:${offering.documentId}`,
      kind: 'offering',
      label: `Offering: ${offering.title}`,
      before: offering.price,
      after: newPrice,
      payload: { kind: 'offering', documentId: offering.documentId, newPrice },
    })
  }

  return changes
}

// ─── Apply a single change ───────────────────────────────────────────────────

export const applyChange = async (change: PlannedChange): Promise<ApplyResult> => {
  try {
    const p = change.payload
    if (p.kind === 'noona-event-type') {
      // Update price on the first variation/first price slot, preserving all IDs
      const orig = p.eventType
      const variations = orig.variations.map((v, vi) => ({
        ...(v.id ? { id: v.id } : {}),
        prices: v.prices.map((pr, pri) => ({
          ...(pr.id ? { id: pr.id } : {}),
          amount: vi === 0 && pri === 0 ? p.newAmount : pr.amount,
          currency: pr.currency ?? 'CZK',
        })),
      }))
      await NoonaHQBase.post(`/event_types/${orig.id}`, { variations })
    } else if (p.kind === 'addon-group') {
      await StrapiAdmin.put(`/api/booking-addon-groups/${p.documentId}`, {
        data: {
          base_price: p.next.base_price,
          modifiers: p.next.modifiers,
          base_modifier_results: p.next.base_modifier_results,
          addons: p.next.addons,
        },
      })
    } else if (p.kind === 'offering') {
      await StrapiAdmin.put(`/api/offerings/${p.documentId}`, {
        data: { price: p.newPrice },
      })
    }
    return { change, status: 'ok' }
  } catch (err) {
    return { change, status: 'error', error: getErr(err) }
  }
}

/**
 * Applies all changes sequentially. Calls onProgress() after each.
 * Returns a flat array of results in input order.
 */
export const applyAllChanges = async (
  changes: PlannedChange[],
  onProgress?: (done: number, total: number) => void,
): Promise<ApplyResult[]> => {
  const results: ApplyResult[] = []
  for (let i = 0; i < changes.length; i++) {
    const r = await applyChange(changes[i])
    results.push(r)
    onProgress?.(i + 1, changes.length)
  }
  return results
}
