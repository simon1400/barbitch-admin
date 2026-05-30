import axios from 'axios'
import { NoonaHQ, NoonaHQBase } from '../../../../lib/noona'
import { calcJuniorPrice } from '../../../../constants/junior'
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
  senior_price?: number
  junior_price?: number
}

export const fetchJuniorMaps = async (): Promise<JuniorMapRecord[]> => {
  const all: JuniorMapRecord[] = []
  let page = 1
  while (true) {
    const res = await StrapiAdmin.get(
      `/api/service-junior-maps?fields[0]=senior_noona_id&fields[1]=junior_noona_id` +
        `&fields[2]=senior_price&fields[3]=junior_price` +
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

// Strapi addon-group component shapes used in PUT body.
// Component `id`s are preserved so Strapi 5 updates entries IN PLACE
// (replacing without ids can mishandle nested components & orphans rows).
export interface AddonGroupData {
  title?: string // only set when renaming the base service
  base_price: number
  modifiers: Array<{ id?: number; key: string; label: string; price_diff: number; group?: string }>
  base_modifier_results: Array<{ id?: number; modifier_keys: string; result_noona_id: string }>
  addons: Array<{
    id?: number
    label: string
    price_diff: number
    result_noona_id: string
    modifier_results: Array<{ id?: number; modifier_keys: string; result_noona_id: string }>
  }>
}

export type ManageOp =
  | { kind: 'noona-price'; id: string; payload: NoonaVariations }
  | { kind: 'noona-title'; id: string; title: string }
  | { kind: 'hide-event-type'; id: string; connections: Record<string, unknown> }
  | { kind: 'addon-group-put'; documentId: string; data: AddonGroupData }
  | { kind: 'addon-group-delete'; documentId: string }
  | { kind: 'offer-price'; documentId: string; newPrice: number }
  | { kind: 'offer-title'; documentId: string; title: string }
  | { kind: 'junior-map-delete'; documentId: string }
  | { kind: 'junior-map-title'; documentId: string; title: string }
  | { kind: 'junior-map-price'; documentId: string; seniorPrice: number; juniorPrice: number }

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

// Convert a fetched group into the AddonGroupData shape, KEEPING component ids
// so the Strapi PUT updates entries in place instead of recreating them.
const toData = (group: StrapiAddonGroup): AddonGroupData => ({
  base_price: group.base_price,
  modifiers: group.modifiers.map((m) => ({
    ...(m.id != null ? { id: m.id } : {}),
    key: m.key,
    label: m.label,
    price_diff: m.price_diff,
    group: m.group, // preserve mutually-exclusive group on price/rename PUT
  })),
  base_modifier_results: group.base_modifier_results.map((r) => ({
    ...(r.id != null ? { id: r.id } : {}),
    modifier_keys: r.modifier_keys,
    result_noona_id: r.result_noona_id,
  })),
  addons: group.addons.map((a) => ({
    ...(a.id != null ? { id: a.id } : {}),
    label: a.label,
    price_diff: a.price_diff,
    result_noona_id: a.result_noona_id,
    modifier_results: (a.modifier_results ?? []).map((r) => ({
      ...(r.id != null ? { id: r.id } : {}),
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

// ─── Title helpers (mirror the create form's buildTitle exactly) ────────────────

// If a part already starts with '+', join with a space only (no extra '+').
// Identical to noonaServices.ts buildTitle — combo titles must match creation.
const buildComboTitle = (base: string, ...parts: string[]): string =>
  parts.reduce((acc, part) => acc + (part.startsWith('+') ? ' ' : ' + ') + part, base)

// Modifier labels for a modifier_keys string, in the modifiers-array order
// (same order the title was built with at creation time).
const labelsForKeys = (modifier_keys: string, modifiers: AddonGroupData['modifiers']): string[] => {
  const set = new Set(keysFromString(modifier_keys))
  return modifiers.filter((m) => set.has(m.key)).map((m) => m.label)
}

// Expected title of every Noona event_type in the group, by id — rebuilt from structure.
const expectedTitles = (
  data: AddonGroupData,
  baseTitle: string,
  baseNoonaId: string,
): Map<string, string> => {
  const map = new Map<string, string>()
  map.set(baseNoonaId, baseTitle)
  for (const bmr of data.base_modifier_results) {
    map.set(bmr.result_noona_id, buildComboTitle(baseTitle, ...labelsForKeys(bmr.modifier_keys, data.modifiers)))
  }
  for (const a of data.addons) {
    map.set(a.result_noona_id, buildComboTitle(baseTitle, a.label))
    for (const mr of a.modifier_results) {
      map.set(
        mr.result_noona_id,
        buildComboTitle(baseTitle, a.label, ...labelsForKeys(mr.modifier_keys, data.modifiers)),
      )
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
  juniorMaps?: JuniorMapRecord[]
}

// Recompute every affected Noona combo + addon-group + matching offers from the new value.
export const buildPriceEditPlan = ({
  group,
  target,
  newValue,
  eventTypes,
  offerings,
  juniorMaps = [],
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
  const juniorBySenior = new Map(juniorMaps.map((jm) => [jm.senior_noona_id, jm]))
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
    // Re-scale the junior copy (−20%) for this senior combo
    ops.push(...juniorRepriceOps(id, price, juniorBySenior, eventTypes))
  }

  // Strapi addon-group component values.
  // before/after must reflect the FIELD that actually changes (not always base_price),
  // otherwise an addon/modifier edit looks like "650 → 650" and seems to do nothing.
  let agBefore = group.base_price
  let agAfter = next.base_price
  let agLabel = `Strapi addon-group: базовая цена «${group.title}»`
  if (target.kind === 'addon') {
    agBefore = group.addons.find((a) => a.label === target.label)?.price_diff ?? 0
    agAfter = newValue
    agLabel = `Strapi addon-group: вариант «${target.label}» (+Kč)`
  } else if (target.kind === 'modifier') {
    const oldMod = group.modifiers.find((m) => m.key === target.key)
    agBefore = oldMod?.price_diff ?? 0
    agAfter = newValue
    agLabel = `Strapi addon-group: дополнение «${oldMod?.label ?? target.key}» (+Kč)`
  }
  ops.push({
    key: `addon-group:${group.documentId}`,
    label: agLabel,
    before: agBefore,
    after: agAfter,
    op: { kind: 'addon-group-put', documentId: group.documentId, data: next },
  })

  return ops
}

// Rename target — same shape as PriceTarget (base / addon by label / modifier by key)
export type RenameTarget = PriceTarget

export interface BuildRenameInput {
  group: StrapiAddonGroup
  target: RenameTarget
  newName: string
  eventTypes: Map<string, ManagedEventType>
  offerings: StrapiOffering[]
  juniorMaps: JuniorMapRecord[]
}

// Rename a base service / addon / modifier everywhere:
//   • Noona base + every combo title that embeds the renamed part (rebuilt from structure)
//   • matching `offer` titles (matched by the CURRENT title)
//   • junior Noona copies (share the senior title) + service-junior-map.title
//   • the Strapi addon-group field (group.title / addons[].label / modifiers[].label)
// Modifier key is kept stable — only the display label changes.
export const buildRenamePlan = ({
  group,
  target,
  newName,
  eventTypes,
  offerings,
  juniorMaps,
}: BuildRenameInput): PlannedManageOp[] => {
  const trimmed = newName.trim()
  if (!trimmed) return []

  const newBaseTitle = target.kind === 'base' ? trimmed : group.title

  // Apply the rename to a working copy of the addon-group data
  const next = toData(group)
  if (target.kind === 'base') {
    next.title = trimmed
  } else if (target.kind === 'addon') {
    const a = next.addons.find((x) => x.label === target.label)
    if (!a) return []
    a.label = trimmed
  } else {
    const m = next.modifiers.find((x) => x.key === target.key)
    if (!m) return []
    m.label = trimmed // key stays the same — modifier_keys references remain valid
  }

  const expected = expectedTitles(next, newBaseTitle, group.base_noona_id)

  // Scope the rename to ONLY the event_types affected by this target.
  // Without this, every combo whose stored title doesn't already match its
  // rebuilt title (legacy/inconsistent titles) would be "corrected" too —
  // renaming one addon would touch base + other addons + modifier combos.
  const affected = new Set<string>()
  if (target.kind === 'base') {
    for (const id of expected.keys()) affected.add(id) // base prefix is in every title
  } else if (target.kind === 'addon') {
    const a = group.addons.find((x) => x.label === target.label)
    if (a) {
      if (a.result_noona_id) affected.add(a.result_noona_id)
      for (const mr of a.modifier_results ?? []) affected.add(mr.result_noona_id)
    }
  } else {
    const includesKey = (keys: string) => keysFromString(keys).includes(target.key)
    for (const bmr of group.base_modifier_results) {
      if (includesKey(bmr.modifier_keys)) affected.add(bmr.result_noona_id)
    }
    for (const a of group.addons) {
      for (const mr of a.modifier_results ?? []) {
        if (includesKey(mr.modifier_keys)) affected.add(mr.result_noona_id)
      }
    }
  }

  const offerByTitle = new Map(offerings.map((o) => [o.title, o]))
  const juniorBySenior = new Map(juniorMaps.map((jm) => [jm.senior_noona_id, jm]))
  const ops: PlannedManageOp[] = []

  for (const [id, newTitle] of expected) {
    if (!affected.has(id)) continue
    const et = eventTypes.get(id)
    if (!et || et.title === newTitle) continue

    // 1. Noona event_type title (senior / base / combo)
    ops.push({
      key: `noona-title:${id}`,
      label: `Noona: «${et.title}» → «${newTitle}»`,
      before: null,
      after: null,
      op: { kind: 'noona-title', id, title: newTitle },
    })

    // 2. offer matched by the CURRENT title
    const offer = offerByTitle.get(et.title)
    if (offer && offer.title !== newTitle) {
      ops.push({
        key: `offer-title:${offer.documentId}`,
        label: `Offer: «${offer.title}» → «${newTitle}»`,
        before: null,
        after: null,
        op: { kind: 'offer-title', documentId: offer.documentId, title: newTitle },
      })
    }

    // 3. junior copy (shares the senior title) + the junior map record
    const jm = juniorBySenior.get(id)
    if (jm) {
      const juniorEt = eventTypes.get(jm.junior_noona_id)
      if (juniorEt && juniorEt.title !== newTitle) {
        ops.push({
          key: `noona-title:${jm.junior_noona_id}`,
          label: `Noona junior: «${juniorEt.title}» → «${newTitle}»`,
          before: null,
          after: null,
          op: { kind: 'noona-title', id: jm.junior_noona_id, title: newTitle },
        })
      }
      ops.push({
        key: `junior-map-title:${jm.documentId}`,
        label: `Junior-map: название → «${newTitle}»`,
        before: null,
        after: null,
        op: { kind: 'junior-map-title', documentId: jm.documentId, title: newTitle },
      })
    }
  }

  // 4. Strapi addon-group field
  const fieldLabel =
    target.kind === 'base'
      ? `название → «${trimmed}»`
      : target.kind === 'addon'
        ? `вариант «${target.label}» → «${trimmed}»`
        : `дополнение → «${trimmed}»`
  ops.push({
    key: `addon-group:${group.documentId}`,
    label: `Strapi addon-group: ${fieldLabel}`,
    before: null,
    after: null,
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

// When a senior combo is DELETED (hidden), its junior copy must follow:
// hide the junior event_type + delete the service-junior-map record.
// Without this, junior masters keep offering a "deleted" variant.
const juniorDeleteOps = (
  seniorId: string,
  juniorBySenior: Map<string, JuniorMapRecord>,
  eventTypes: Map<string, ManagedEventType>,
): PlannedManageOp[] => {
  const jm = juniorBySenior.get(seniorId)
  if (!jm) return []
  const ops: PlannedManageOp[] = []
  if (jm.junior_noona_id) ops.push(hideOp(jm.junior_noona_id, eventTypes))
  ops.push({
    key: `junior-map:${jm.documentId}`,
    label: `Удалить junior-маппинг: ${seniorId} → ${jm.junior_noona_id}`,
    before: null,
    after: null,
    op: { kind: 'junior-map-delete', documentId: jm.documentId },
  })
  return ops
}

// When a senior combo is REPRICED, its junior copy must be re-scaled (−20%)
// and the service-junior-map prices updated. Without this junior prices drift.
const juniorRepriceOps = (
  seniorId: string,
  newSeniorPrice: number,
  juniorBySenior: Map<string, JuniorMapRecord>,
  eventTypes: Map<string, ManagedEventType>,
): PlannedManageOp[] => {
  const jm = juniorBySenior.get(seniorId)
  if (!jm) return []
  const newJuniorPrice = calcJuniorPrice(newSeniorPrice)
  const ops: PlannedManageOp[] = []
  const jEt = eventTypes.get(jm.junior_noona_id)
  if (jEt && jEt.price !== newJuniorPrice) {
    ops.push({
      key: `noona-price:${jm.junior_noona_id}`,
      label: `Junior: ${jEt.title}`,
      before: jEt.price,
      after: newJuniorPrice,
      op: { kind: 'noona-price', id: jm.junior_noona_id, payload: buildVariations(jEt, newJuniorPrice) },
    })
  }
  if (jm.senior_price !== newSeniorPrice || jm.junior_price !== newJuniorPrice) {
    ops.push({
      key: `junior-map-price:${jm.documentId}`,
      label: `Junior-map цена: ${newSeniorPrice} / ${newJuniorPrice}`,
      before: jm.junior_price ?? null,
      after: newJuniorPrice,
      op: { kind: 'junior-map-price', documentId: jm.documentId, seniorPrice: newSeniorPrice, juniorPrice: newJuniorPrice },
    })
  }
  return ops
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
  juniorMaps: JuniorMapRecord[] = [],
): PlannedManageOp[] => {
  const addon = group.addons.find((a) => a.label === addonLabel)
  if (!addon) return []
  const hideIds = [addon.result_noona_id, ...(addon.modifier_results ?? []).map((r) => r.result_noona_id)]
  const juniorBySenior = new Map(juniorMaps.map((jm) => [jm.senior_noona_id, jm]))
  const ops: PlannedManageOp[] = []
  for (const id of hideIds.filter(Boolean)) {
    ops.push(hideOp(id, eventTypes))
    // also hide the junior copy of this combo + drop its junior-map record
    ops.push(...juniorDeleteOps(id, juniorBySenior, eventTypes))
  }

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
  juniorMaps: JuniorMapRecord[] = [],
): PlannedManageOp[] => {
  const includesKey = (modifier_keys: string) => keysFromString(modifier_keys).includes(modifierKey)

  const hideIds: string[] = []
  for (const bmr of group.base_modifier_results) if (includesKey(bmr.modifier_keys)) hideIds.push(bmr.result_noona_id)
  for (const a of group.addons)
    for (const mr of a.modifier_results ?? []) if (includesKey(mr.modifier_keys)) hideIds.push(mr.result_noona_id)

  const juniorBySenior = new Map(juniorMaps.map((jm) => [jm.senior_noona_id, jm]))
  const ops: PlannedManageOp[] = []
  for (const id of hideIds.filter(Boolean)) {
    ops.push(hideOp(id, eventTypes))
    ops.push(...juniorDeleteOps(id, juniorBySenior, eventTypes))
  }

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
      case 'noona-title':
        await NoonaHQBase.post(`/event_types/${op.id}`, { title: op.title })
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
      case 'offer-title':
        await StrapiAdmin.put(`/api/offerings/${op.documentId}`, { data: { title: op.title } })
        break
      case 'junior-map-delete':
        await StrapiAdmin.delete(`/api/service-junior-maps/${op.documentId}`)
        break
      case 'junior-map-title':
        await StrapiAdmin.put(`/api/service-junior-maps/${op.documentId}`, { data: { title: op.title } })
        break
      case 'junior-map-price':
        await StrapiAdmin.put(`/api/service-junior-maps/${op.documentId}`, {
          data: { senior_price: op.seniorPrice, junior_price: op.juniorPrice },
        })
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
