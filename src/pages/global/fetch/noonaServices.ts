import { NoonaHQ, NoonaHQBase } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

let cachedVatId: string | null = null

type ApiError = { response?: { data?: { message?: string } }; message?: string }

const getErrorMessage = (err: unknown) => {
  const e = err as ApiError
  return e?.response?.data?.message ?? e?.message ?? 'Ошибка'
}

const getVatId = async (): Promise<string | null> => {
  if (cachedVatId !== null) return cachedVatId
  try {
    const res = await NoonaHQ.get(`/${COMPANY_ID}/vats`)
    const vats: { id?: string; percent?: number; rate?: number }[] = res.data
    if (!Array.isArray(vats) || vats.length === 0) return null
    const zeroVat = vats.find((v) => v.percent === 0 || v.rate === 0)
    cachedVatId = (zeroVat ?? vats[0])?.id ?? null
    return cachedVatId
  } catch {
    return null
  }
}

interface EventTypePref {
  event_type: string | { id?: string }
  has_custom_duration?: boolean
  skip_calendar?: boolean
}

const assignServiceToEmployee = async (empId: string, serviceId: string) => {
  const empRes = await NoonaHQ.get(`/${COMPANY_ID}/employees/${empId}`)
  const prefs: EventTypePref[] = empRes.data?.event_type_preferences ?? []
  const alreadyAssigned = prefs.some((p) => {
    const etId = typeof p.event_type === 'object' ? p.event_type?.id : p.event_type
    return etId === serviceId
  })
  if (alreadyAssigned) return
  await NoonaHQ.post(`/${COMPANY_ID}/employees/${empId}`, {
    event_type_preferences: [
      ...prefs,
      { event_type: serviceId, has_custom_duration: false, skip_calendar: false },
    ],
  })
}

const addServiceToGroup = async (categoryId: string, serviceId: string) => {
  const groupsRes = await NoonaHQ.get(
    `/${COMPANY_ID}/event_type_groups?expand[]=ordered_event_types.event_type`,
  )
  const groups: { id: string; ordered_event_types?: { event_type?: { id?: string } | string; id?: string }[] }[] =
    groupsRes.data ?? []
  const targetGroup = groups.find((g) => g.id === categoryId)
  const ordered = targetGroup?.ordered_event_types ?? []
  const currentIds = ordered.map((item) => {
    if (typeof item === 'string') return item
    const et = item.event_type
    return (typeof et === 'object' ? et?.id : et) ?? item.id ?? ''
  })
  await NoonaHQBase.post(`/event_type_groups/${categoryId}`, {
    event_types: [...currentIds, serviceId],
  })
}

export interface CreateServicePayload {
  title: string
  minutes: number
  price: number
  employeeIds: string[]
  categoryId?: string
}

export interface CreateServiceResult {
  id: string
  title: string
  status: 'ok' | 'error'
  error?: string
  warning?: string
}

// ─── Categories (event_type_groups) ──────────────────────────────────────────

export interface NoonaCategory {
  id: string
  title: string
}

export const getNoonaCategories = async (): Promise<NoonaCategory[]> => {
  try {
    const res = await NoonaHQ.get(`/${COMPANY_ID}/event_type_groups`)
    const groups: { id?: string; title?: string }[] = Array.isArray(res.data) ? res.data : []
    return groups.filter((g) => g.id && g.title).map((g) => ({ id: g.id!, title: g.title! }))
  } catch {
    return []
  }
}

// ─── Search existing Noona services ───────────────────────────────────────────

export interface NoonaServiceItem {
  id: string
  title: string
  duration: number
  price: number
}

let cachedServices: NoonaServiceItem[] | null = null

export const searchNoonaServices = async (query: string): Promise<NoonaServiceItem[]> => {
  if (!cachedServices) {
    try {
      const res = await NoonaHQ.get(`/${COMPANY_ID}/event_types?expand[]=variations.prices`)
      const items: {
        id?: string
        title?: string
        duration?: number
        connections?: { hidden?: boolean }
        variations?: { prices?: { amount?: number }[] }[]
      }[] = Array.isArray(res.data) ? res.data : []
      cachedServices = items
        .filter((s) => !s.connections?.hidden)
        .map((s) => ({
          id: s.id ?? '',
          title: s.title ?? '',
          duration: s.duration ?? 60,
          price: s.variations?.[0]?.prices?.[0]?.amount ?? 0,
        }))
        .filter((s) => s.id)
    } catch {
      return []
    }
  }
  const q = query.trim().toLowerCase()
  if (!q) return cachedServices.slice(0, 10)
  return cachedServices.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 10)
}

// ─── Combo / full-matrix helpers ─────────────────────────────────────────────

export function getAllSubsets<T>(arr: T[]): T[][] {
  const result: T[][] = []
  for (let mask = 1; mask < 1 << arr.length; mask++) {
    const subset: T[] = []
    for (let i = 0; i < arr.length; i++) {
      if (mask & (1 << i)) subset.push(arr[i])
    }
    result.push(subset)
  }
  return result
}

export interface AddonInput {
  label: string
  priceDiff: number
}

export interface ModifierInput {
  label: string
  priceDiff: number
}

// addonResults       — каждый addon без модификаторов     (addon.result_noona_id)
// baseModifierResults — base + каждое непустое подмножество модификаторов (base_modifier_results)
// addonModifierResults — каждый addon + каждое подмножество модификаторов (addon.modifier_results)
export interface FullCombosResult {
  addonResults: Array<{ addon: AddonInput; result: CreateServiceResult }>
  baseModifierResults: Array<{ modifierKeys: string; result: CreateServiceResult }>
  addonModifierResults: Array<{
    addon: AddonInput
    modifierKeys: string
    result: CreateServiceResult
  }>
}

// Context for an addon that already exists in Strapi —
// used to create only MISSING cross-combo modifier results
export interface ExistingAddonContext {
  label: string
  priceDiff: number
  existingModResultKeys: Set<string> // modifier_keys combos already stored in Strapi
}

const createHiddenNoonaService = async (
  title: string,
  minutes: number,
  price: number,
  categoryId?: string,
): Promise<CreateServiceResult> => {
  try {
    const vatId = await getVatId()
    const body: Record<string, unknown> = {
      company: COMPANY_ID,
      title,
      duration: minutes,
      color: '#FF787D',
      variations: [{ prices: [{ amount: price, currency: 'CZK' }] }],
      connections: { hidden: true, customer_selects: 'employee', service_needs: 'employee' },
    }
    if (vatId) body.vat = vatId
    const res = await NoonaHQBase.post(`/event_types`, body)
    const data = res.data
    const newId: string = data?.id ?? data?._id ?? '—'
    if (categoryId && newId !== '—') {
      await addServiceToGroup(categoryId, newId).catch(() => {})
    }
    return { id: newId, title, status: 'ok' }
  } catch (err) {
    return { id: '—', title, status: 'error', error: getErrorMessage(err) }
  }
}

const toKey = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

// Creates Noona services only for MISSING combinations:
//   • new addons — base service + all subsets of allModifiers
//   • existing addons — only subsets NOT already in existingAddonContext.existingModResultKeys
//   • base — only subsets NOT already in existingBaseModResultKeys
export const createMissingCombinations = async (
  baseTitle: string,
  minutes: number,
  basePrice: number,
  newAddons: AddonInput[],
  existingAddonContexts: ExistingAddonContext[],
  allModifiers: ModifierInput[],
  existingBaseModResultKeys: Set<string>,
  categoryId?: string,
): Promise<FullCombosResult> => {
  const result: FullCombosResult = { addonResults: [], baseModifierResults: [], addonModifierResults: [] }

  // 1. New addons — create base (no modifier) service
  for (const addon of newAddons) {
    const r = await createHiddenNoonaService(
      `${baseTitle} ${addon.label}`, minutes, basePrice + addon.priceDiff, categoryId,
    )
    result.addonResults.push({ addon, result: r })
  }

  if (allModifiers.length === 0) return result

  const allSubsets = getAllSubsets(allModifiers)

  // 2. Base × missing modifier subsets
  for (const subset of allSubsets) {
    const modifierKeys = subset.map((m) => toKey(m.label)).sort().join(',')
    if (existingBaseModResultKeys.has(modifierKeys)) continue
    const r = await createHiddenNoonaService(
      `${baseTitle} ${subset.map((m) => m.label).join(' ')}`,
      minutes,
      basePrice + subset.reduce((s, m) => s + m.priceDiff, 0),
      categoryId,
    )
    result.baseModifierResults.push({ modifierKeys, result: r })
  }

  // 3. New addons × all modifier subsets (all are new for them)
  for (const addon of newAddons) {
    for (const subset of allSubsets) {
      const modifierKeys = subset.map((m) => toKey(m.label)).sort().join(',')
      const r = await createHiddenNoonaService(
        `${baseTitle} ${addon.label} ${subset.map((m) => m.label).join(' ')}`,
        minutes,
        basePrice + addon.priceDiff + subset.reduce((s, m) => s + m.priceDiff, 0),
        categoryId,
      )
      result.addonModifierResults.push({ addon, modifierKeys, result: r })
    }
  }

  // 4. Existing addons × missing modifier subsets
  for (const ctx of existingAddonContexts) {
    const addonInput: AddonInput = { label: ctx.label, priceDiff: ctx.priceDiff }
    for (const subset of allSubsets) {
      const modifierKeys = subset.map((m) => toKey(m.label)).sort().join(',')
      if (ctx.existingModResultKeys.has(modifierKeys)) continue
      const r = await createHiddenNoonaService(
        `${baseTitle} ${ctx.label} ${subset.map((m) => m.label).join(' ')}`,
        minutes,
        basePrice + ctx.priceDiff + subset.reduce((s, m) => s + m.priceDiff, 0),
        categoryId,
      )
      result.addonModifierResults.push({ addon: addonInput, modifierKeys, result: r })
    }
  }

  return result
}

export const createFullServiceCombinations = async (
  baseTitle: string,
  minutes: number,
  basePrice: number,
  addons: AddonInput[],
  modifiers: ModifierInput[],
  categoryId?: string,
): Promise<FullCombosResult> => {
  const result: FullCombosResult = {
    addonResults: [],
    baseModifierResults: [],
    addonModifierResults: [],
  }

  // 1. Каждый addon без модификаторов → addon.result_noona_id
  for (const addon of addons) {
    const r = await createHiddenNoonaService(
      `${baseTitle} ${addon.label}`,
      minutes,
      basePrice + addon.priceDiff,
      categoryId,
    )
    result.addonResults.push({ addon, result: r })
  }

  if (modifiers.length === 0) return result

  const modSubsets = getAllSubsets(modifiers)

  // 2. База + каждое подмножество модификаторов → base_modifier_results
  for (const subset of modSubsets) {
    const modifierKeys = subset
      .map((m) => toKey(m.label))
      .sort()
      .join(',')
    const r = await createHiddenNoonaService(
      `${baseTitle} ${subset.map((m) => m.label).join(' ')}`,
      minutes,
      basePrice + subset.reduce((s, m) => s + m.priceDiff, 0),
      categoryId,
    )
    result.baseModifierResults.push({ modifierKeys, result: r })
  }

  // 3. Каждый addon + каждое подмножество модификаторов → addon.modifier_results
  for (const addon of addons) {
    for (const subset of modSubsets) {
      const modifierKeys = subset
        .map((m) => toKey(m.label))
        .sort()
        .join(',')
      const r = await createHiddenNoonaService(
        `${baseTitle} ${addon.label} ${subset.map((m) => m.label).join(' ')}`,
        minutes,
        basePrice + addon.priceDiff + subset.reduce((s, m) => s + m.priceDiff, 0),
        categoryId,
      )
      result.addonModifierResults.push({ addon, modifierKeys, result: r })
    }
  }

  return result
}

// ─── Original single-service creation ─────────────────────────────────────────

export const createNoonaService = async (
  payload: CreateServicePayload,
): Promise<CreateServiceResult> => {
  try {
    const vatId = await getVatId()
    const body: Record<string, unknown> = {
      company: COMPANY_ID,
      title: payload.title,
      duration: payload.minutes,
      color: '#FF787D',
      variations: [{ prices: [{ amount: payload.price, currency: 'CZK' }] }],
      connections: { hidden: false, customer_selects: 'employee', service_needs: 'employee' },
    }
    if (vatId) body.vat = vatId

    const res = await NoonaHQBase.post(`/event_types`, body)
    const data = res.data
    const newId: string = data?.id ?? data?._id ?? '—'

    let warning: string | undefined

    if (newId !== '—' && payload.employeeIds.length > 0) {
      try {
        // When at least one employee has explicit prefs, Noona switches to whitelist mode
        await Promise.all(
          payload.employeeIds.map((empId) => assignServiceToEmployee(empId, newId).catch(() => {})),
        )
      } catch (err) {
        warning = `Мастера созданы, но фильтрация не удалась: ${getErrorMessage(err)}`
      }
    }

    if (payload.categoryId && newId !== '—') {
      await addServiceToGroup(payload.categoryId, newId).catch(() => {})
    }

    return { id: newId, title: payload.title, status: 'ok', warning }
  } catch (err) {
    return { id: '—', title: payload.title, status: 'error', error: getErrorMessage(err) }
  }
}
