import axios from 'axios'
import { NoonaHQ, NoonaHQBase } from '../../../../lib/noona'
import {
  fetchAllAddonGroups,
  fetchAllOfferings,
  type StrapiAddonGroup,
  type StrapiOffering,
} from '../../fetch/priceIncrease'

export { fetchAllAddonGroups, fetchAllOfferings }
export type { StrapiAddonGroup, StrapiOffering }

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1350'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

const StrapiAdmin = axios.create({ baseURL: apiUrl })
StrapiAdmin.interceptors.request.use((config) => {
  if (strapiToken) config.headers.Authorization = `Bearer ${strapiToken}`
  return config
})

const getErr = (err: unknown): string => {
  const e = err as {
    response?: { data?: { error?: { message?: string }; message?: string } }
    message?: string
  }
  return (
    e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Неизвестная ошибка'
  )
}

// modifier label → key (same rule as create form / strapiAddonGroups)
export const toKey = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

// ─── Noona event types (full — keeps connections for safe hide merge) ──────────

export interface ManagedEventType {
  id: string
  title: string
  hidden: boolean
  price: number
  variations: Array<{ id?: string; prices: Array<{ id?: string; amount: number; currency?: string }> }>
  connections: Record<string, unknown>
}

export const fetchEventTypesWithConnections = async (): Promise<ManagedEventType[]> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/event_types?expand[]=variations.prices`)
  const items: Array<{
    id?: string
    title?: string
    connections?: Record<string, unknown>
    variations?: Array<{ id?: string; prices?: Array<{ id?: string; amount?: number; currency?: string }> }>
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
      return {
        id: s.id!,
        title: s.title ?? '(без названия)',
        hidden: Boolean((s.connections as { hidden?: boolean } | undefined)?.hidden),
        price: variations[0]?.prices[0]?.amount ?? 0,
        variations,
        connections: s.connections ?? {},
      }
    })
}

// ─── Junior maps ───────────────────────────────────────────────────────────────

export interface JuniorMapRecord {
  documentId: string
  senior_noona_id: string
  junior_noona_id: string
}

export const fetchJuniorMaps = async (): Promise<JuniorMapRecord[]> => {
  const all: JuniorMapRecord[] = []
  let page = 1
  while (true) {
    const res = await StrapiAdmin.get(
      `/api/service-junior-maps?fields[0]=senior_noona_id&fields[1]=junior_noona_id` +
        `&pagination[page]=${page}&pagination[pageSize]=200`,
    )
    const data = res.data?.data ?? []
    const meta = res.data?.meta?.pagination
    all.push(...(data as JuniorMapRecord[]))
    if (!meta || page >= meta.pageCount || data.length === 0) break
    page++
  }
  return all
}

// ─── Operations ──────────────────────────────────────────────────────────────

interface NoonaVariations {
  variations: Array<{ id?: string; prices: Array<{ id?: string; amount: number; currency?: string }> }>
}

// Strapi addon-group component shapes used in PUT body
export interface AddonGroupData {
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

export type ManageOp =
  | { kind: 'noona-price'; id: string; payload: NoonaVariations }
  | { kind: 'hide-event-type'; id: string; connections: Record<string, unknown> }
  | { kind: 'addon-group-put'; documentId: string; data: AddonGroupData }
  | { kind: 'addon-group-delete'; documentId: string }
  | { kind: 'offer-price'; documentId: string; newPrice: number }
  | { kind: 'junior-map-delete'; documentId: string }

export interface PlannedManageOp {
  key: string
  label: string
  before: number | null
  after: number | null
  op: ManageOp
}

export interface OpResult {
  planned: PlannedManageOp
  status: 'ok' | 'error'
  error?: string
}

// ─── Price helpers ─────────────────────────────────────────────────────────────

const keysFromString = (modifier_keys: string): string[] =>
  modifier_keys.split(',').map((k) => k.trim()).filter(Boolean)

// Σ price_diff of modifiers present in a combo
const sumMods = (modifier_keys: string, modifiers: AddonGroupData['modifiers']): number => {
  const set = new Set(keysFromString(modifier_keys))
  return modifiers.reduce((s, m) => (set.has(m.key) ? s + m.price_diff : s), 0)
}

// Build a Noona variations body that updates only the first price slot, preserving all ids
const buildVariations = (et: ManagedEventType, newAmount: number): NoonaVariations => ({
  variations: et.variations.map((v, vi) => ({
    ...(v.id ? { id: v.id } : {}),
    prices: v.prices.map((pr, pri) => ({
      ...(pr.id ? { id: pr.id } : {}),
      amount: vi === 0 && pri === 0 ? newAmount : pr.amount,
      currency: pr.currency ?? 'CZK',
    })),
  })),
})

// Convert a fetched group into the plain AddonGroupData shape (drops ids)
const toData = (group: StrapiAddonGroup): AddonGroupData => ({
  base_price: group.base_price,
  modifiers: group.modifiers.map((m) => ({ key: m.key, label: m.label, price_diff: m.price_diff })),
  base_modifier_results: group.base_modifier_results.map((r) => ({
    modifier_keys: r.modifier_keys,
    result_noona_id: r.result_noona_id,
  })),
  addons: group.addons.map((a) => ({
    label: a.label,
    price_diff: a.price_diff,
    result_noona_id: a.result_noona_id,
    modifier_results: (a.modifier_results ?? []).map((r) => ({
      modifier_keys: r.modifier_keys,
      result_noona_id: r.result_noona_id,
    })),
  })),
})

// Expected price of every Noona event_type in the group, by id
const expectedPrices = (data: AddonGroupData, baseNoonaId: string): Map<string, number> => {
  const map = new Map<string, number>()
  map.set(baseNoonaId, data.base_price)
  for (const bmr of data.base_modifier_results) {
    map.set(bmr.result_noona_id, data.base_price + sumMods(bmr.modifier_keys, data.modifiers))
  }
  for (const a of data.addons) {
    map.set(a.result_noona_id, data.base_price + a.price_diff)
    for (const mr of a.modifier_results) {
      map.set(mr.result_noona_id, data.base_price + a.price_diff + sumMods(mr.modifier_keys, data.modifiers))
    }
  }
  return map
}

// All Noona ids referenced by a group
const allGroupIds = (group: StrapiAddonGroup): string[] => {
  const ids = [group.base_noona_id]
  for (const bmr of group.base_modifier_results) ids.push(bmr.result_noona_id)
  for (const a of group.addons) {
    ids.push(a.result_noona_id)
    for (const mr of a.modifier_results ?? []) ids.push(mr.result_noona_id)
  }
  return ids.filter(Boolean)
}

// ─── Plan builders ─────────────────────────────────────────────────────────────

export type PriceTarget =
  | { kind: 'base' }
  | { kind: 'addon'; label: string }
  | { kind: 'modifier'; key: string }

export interface BuildPriceEditInput {
  group: StrapiAddonGroup
  target: PriceTarget
  newValue: number // base: absolute base_price; addon/modifier: absolute price_diff
  eventTypes: Map<string, ManagedEventType>
  offerings: StrapiOffering[]
}

// Recompute every affected Noona combo + addon-group + matching offers from the new value.
export const buildPriceEditPlan = ({
  group,
  target,
  newValue,
  eventTypes,
  offerings,
}: BuildPriceEditInput): PlannedManageOp[] => {
  const next = toData(group)
  if (target.kind === 'base') next.base_price = newValue
  else if (target.kind === 'addon') {
    const a = next.addons.find((x) => x.label === target.label)
    if (a) a.price_diff = newValue
  } else {
    const m = next.modifiers.find((x) => x.key === target.key)
    if (m) m.price_diff = newValue
  }

  const expected = expectedPrices(next, group.base_noona_id)
  const offerByTitle = new Map(offerings.map((o) => [o.title, o]))
  const ops: PlannedManageOp[] = []

  // Noona price updates (only where amount actually changes) + offer sync by title
  for (const [id, price] of expected) {
    const et = eventTypes.get(id)
    if (!et) continue
    if (price !== et.price) {
      ops.push({
        key: `noona-price:${id}`,
        label: et.title + (et.hidden ? ' (hidden combo)' : ''),
        before: et.price,
        after: price,
        op: { kind: 'noona-price', id, payload: buildVariations(et, price) },
      })
    }
    const offer = offerByTitle.get(et.title)
    if (offer && offer.price !== price) {
      ops.push({
        key: `offer:${offer.documentId}`,
        label: `Offer: ${offer.title}`,
        before: offer.price,
        after: price,
        op: { kind: 'offer-price', documentId: offer.documentId, newPrice: price },
      })
    }
  }

  // Strapi addon-group component values
  ops.push({
    key: `addon-group:${group.documentId}`,
    label: `Strapi addon-group: ${group.title}`,
    before: group.base_price,
    after: next.base_price,
    op: { kind: 'addon-group-put', documentId: group.documentId, data: next },
  })

  return ops
}

const hideOp = (id: string, eventTypes: Map<string, ManagedEventType>): PlannedManageOp => {
  const et = eventTypes.get(id)
  return {
    key: `hide:${id}`,
    label: `Скрыть в Noona: ${et?.title ?? id}`,
    before: null,
    after: null,
    op: { kind: 'hide-event-type', id, connections: { ...(et?.connections ?? {}), hidden: true } },
  }
}

export interface BuildDeleteServiceInput {
  group: StrapiAddonGroup
  eventTypes: Map<string, ManagedEventType>
  juniorMaps: JuniorMapRecord[]
}

export const buildDeleteServicePlan = ({
  group,
  eventTypes,
  juniorMaps,
}: BuildDeleteServiceInput): PlannedManageOp[] => {
  const ids = allGroupIds(group)
  const idSet = new Set(ids)
  const ops: PlannedManageOp[] = ids.map((id) => hideOp(id, eventTypes))

  // Junior cleanup — maps whose senior is any of the deleted ids
  for (const jm of juniorMaps) {
    if (!idSet.has(jm.senior_noona_id)) continue
    if (jm.junior_noona_id) ops.push(hideOp(jm.junior_noona_id, eventTypes))
    ops.push({
      key: `junior-map:${jm.documentId}`,
      label: `Удалить junior-маппинг: ${jm.senior_noona_id} → ${jm.junior_noona_id}`,
      before: null,
      after: null,
      op: { kind: 'junior-map-delete', documentId: jm.documentId },
    })
  }

  ops.push({
    key: `addon-group-delete:${group.documentId}`,
    label: `Удалить addon-group в Strapi: ${group.title}`,
    before: null,
    after: null,
    op: { kind: 'addon-group-delete', documentId: group.documentId },
  })

  return ops
}

export const buildDeleteAddonPlan = (
  group: StrapiAddonGroup,
  addonLabel: string,
  eventTypes: Map<string, ManagedEventType>,
): PlannedManageOp[] => {
  const addon = group.addons.find((a) => a.label === addonLabel)
  if (!addon) return []
  const hideIds = [addon.result_noona_id, ...(addon.modifier_results ?? []).map((r) => r.result_noona_id)]
  const ops: PlannedManageOp[] = hideIds.filter(Boolean).map((id) => hideOp(id, eventTypes))

  const next = toData(group)
  next.addons = next.addons.filter((a) => a.label !== addonLabel)
  ops.push({
    key: `addon-group:${group.documentId}`,
    label: `Strapi addon-group: убрать вариант «${addonLabel}»`,
    before: null,
    after: null,
    op: { kind: 'addon-group-put', documentId: group.documentId, data: next },
  })
  return ops
}

export const buildDeleteModifierPlan = (
  group: StrapiAddonGroup,
  modifierKey: string,
  eventTypes: Map<string, ManagedEventType>,
): PlannedManageOp[] => {
  const includesKey = (modifier_keys: string) => keysFromString(modifier_keys).includes(modifierKey)

  const hideIds: string[] = []
  for (const bmr of group.base_modifier_results) if (includesKey(bmr.modifier_keys)) hideIds.push(bmr.result_noona_id)
  for (const a of group.addons)
    for (const mr of a.modifier_results ?? []) if (includesKey(mr.modifier_keys)) hideIds.push(mr.result_noona_id)

  const ops: PlannedManageOp[] = hideIds.filter(Boolean).map((id) => hideOp(id, eventTypes))

  const next = toData(group)
  next.modifiers = next.modifiers.filter((m) => m.key !== modifierKey)
  next.base_modifier_results = next.base_modifier_results.filter((r) => !includesKey(r.modifier_keys))
  next.addons = next.addons.map((a) => ({
    ...a,
    modifier_results: a.modifier_results.filter((r) => !includesKey(r.modifier_keys)),
  }))
  ops.push({
    key: `addon-group:${group.documentId}`,
    label: `Strapi addon-group: убрать дополнение «${modifierKey}»`,
    before: null,
    after: null,
    op: { kind: 'addon-group-put', documentId: group.documentId, data: next },
  })
  return ops
}

// ─── Apply ───────────────────────────────────────────────────────────────────

export const applyOp = async (planned: PlannedManageOp): Promise<OpResult> => {
  try {
    const op = planned.op
    switch (op.kind) {
      case 'noona-price':
        await NoonaHQBase.post(`/event_types/${op.id}`, op.payload)
        break
      case 'hide-event-type':
        await NoonaHQBase.post(`/event_types/${op.id}`, { connections: op.connections })
        break
      case 'addon-group-put':
        await StrapiAdmin.put(`/api/booking-addon-groups/${op.documentId}`, { data: op.data })
        break
      case 'addon-group-delete':
        await StrapiAdmin.delete(`/api/booking-addon-groups/${op.documentId}`)
        break
      case 'offer-price':
        await StrapiAdmin.put(`/api/offerings/${op.documentId}`, { data: { price: op.newPrice } })
        break
      case 'junior-map-delete':
        await StrapiAdmin.delete(`/api/service-junior-maps/${op.documentId}`)
        break
    }
    return { planned, status: 'ok' }
  } catch (err) {
    return { planned, status: 'error', error: getErr(err) }
  }
}

export const applyAllOps = async (
  ops: PlannedManageOp[],
  onProgress?: (done: number, total: number) => void,
): Promise<OpResult[]> => {
  const results: OpResult[] = []
  for (let i = 0; i < ops.length; i++) {
    results.push(await applyOp(ops[i]))
    onProgress?.(i + 1, ops.length)
  }
  return results
}
