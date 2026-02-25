import axios from 'axios'
import type { AddonInput, FullCombosResult, ModifierInput } from './noonaServices'

export interface ExistingAddonGroupRecord {
  id: number
  documentId: string
  modifiers: { key: string; label: string; price_diff: number }[]
  base_modifier_results: { modifier_keys: string; result_noona_id: string }[]
  addons: {
    label: string
    price_diff: number
    result_noona_id: string
    modifier_results?: { modifier_keys: string; result_noona_id: string }[]
  }[]
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1350'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

const StrapiAdmin = axios.create({ baseURL: apiUrl })
StrapiAdmin.interceptors.request.use(
  (config) => {
    if (strapiToken) config.headers.Authorization = `Bearer ${strapiToken}`
    return config
  },
  (e) => Promise.reject(e),
)

const toKey = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

// ─── Strapi component shapes ───────────────────────────────────────────────────

interface StrapiModifier { id?: number; key: string; label: string; price_diff: number }
interface StrapiModResult { id?: number; modifier_keys: string; result_noona_id: string }
interface StrapiAddon {
  id?: number
  label: string
  price_diff: number
  result_noona_id: string
  modifier_results?: StrapiModResult[]
}
interface StrapiEntry {
  id: number
  documentId: string
  modifiers?: StrapiModifier[]
  base_modifier_results?: StrapiModResult[]
  addons?: StrapiAddon[]
}

const POPULATE_QUERY =
  `?populate[modifiers]=true` +
  `&populate[base_modifier_results]=true` +
  `&populate[addons][populate][modifier_results]=true`

export const fetchExistingAddonGroup = async (
  baseNoonaId: string,
): Promise<ExistingAddonGroupRecord | null> => {
  try {
    const res = await StrapiAdmin.get(
      `/api/booking-addon-groups${POPULATE_QUERY}` +
        `&filters[base_noona_id][$eq]=${encodeURIComponent(baseNoonaId)}`,
    )
    const data: ExistingAddonGroupRecord[] = res.data?.data ?? []
    return data[0] ?? null
  } catch {
    return null
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface SaveAddonGroupPayload {
  baseNoonaId: string
  baseTitle: string
  basePrice: number
  addons: AddonInput[]
  modifiers: ModifierInput[]
  combos: FullCombosResult
}

export const saveBookingAddonGroup = async (
  payload: SaveAddonGroupPayload,
): Promise<{ id: number | string }> => {
  const { baseNoonaId, baseTitle, basePrice, addons, modifiers, combos } = payload

  // Build new component data from current form submission
  const newModifiers: StrapiModifier[] = modifiers.map((m) => ({
    key: toKey(m.label),
    label: m.label,
    price_diff: m.priceDiff,
  }))

  const newBaseModifierResults: StrapiModResult[] = combos.baseModifierResults
    .filter((bmr) => bmr.result.status === 'ok' && bmr.result.id !== '—')
    .map((bmr) => ({ modifier_keys: bmr.modifierKeys, result_noona_id: bmr.result.id }))

  const newAddons = addons
    .map((addon) => {
      const addonResult = combos.addonResults.find((ar) => ar.addon.label === addon.label)
      if (!addonResult || addonResult.result.status !== 'ok' || addonResult.result.id === '—') return null
      return {
        label: addon.label,
        price_diff: addon.priceDiff,
        result_noona_id: addonResult.result.id,
        modifier_results: combos.addonModifierResults
          .filter((amr) => amr.addon.label === addon.label && amr.result.status === 'ok')
          .map((amr) => ({ modifier_keys: amr.modifierKeys, result_noona_id: amr.result.id })),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Fetch existing record with all nested components populated
  let checkRes
  try {
    checkRes = await StrapiAdmin.get(
      `/api/booking-addon-groups${POPULATE_QUERY}` +
        `&filters[base_noona_id][$eq]=${encodeURIComponent(baseNoonaId)}`,
    )
  } catch (err) {
    console.error('[Strapi] GET booking-addon-groups failed:', err)
    throw err
  }

  const existing: StrapiEntry[] = checkRes.data?.data ?? []

  if (existing.length > 0) {
    const {
      id: entryId,
      documentId,
      modifiers: existingMods = [],
      base_modifier_results: existingBMR = [],
      addons: existingAddons = [],
    } = existing[0]

    // Strapi 5 rejects component ids in PUT body → strip all ids from existing components

    // Merge modifiers — add only new keys
    const existingModKeys = new Set(existingMods.map((m) => m.key))
    const mergedModifiers = [
      ...existingMods.map((m) => ({ key: m.key, label: m.label, price_diff: m.price_diff })),
      ...newModifiers.filter((m) => !existingModKeys.has(m.key)),
    ]

    // Merge base_modifier_results — add only new modifier_keys
    const existingBMRKeys = new Set(existingBMR.map((r) => r.modifier_keys))
    const mergedBMR = [
      ...existingBMR.map((r) => ({ modifier_keys: r.modifier_keys, result_noona_id: r.result_noona_id })),
      ...newBaseModifierResults.filter((r) => !existingBMRKeys.has(r.modifier_keys)),
    ]

    // Merge addons — if same label exists, merge its modifier_results; otherwise append
    const existingAddonMap = new Map(existingAddons.map((a) => [a.label, a]))
    const mergedAddons: Omit<StrapiAddon, 'id'>[] = []

    for (const ea of existingAddons) {
      const newAddon = newAddons.find((na) => na.label === ea.label)
      const existingMRs = (ea.modifier_results ?? []).map((r) => ({
        modifier_keys: r.modifier_keys,
        result_noona_id: r.result_noona_id,
      }))
      if (newAddon) {
        const existingMRKeys = new Set(existingMRs.map((r) => r.modifier_keys))
        mergedAddons.push({
          label: ea.label,
          price_diff: ea.price_diff,
          result_noona_id: ea.result_noona_id,
          modifier_results: [
            ...existingMRs,
            ...newAddon.modifier_results.filter((r) => !existingMRKeys.has(r.modifier_keys)),
          ],
        })
      } else {
        // Also add cross-combo modifier results created in this session
        const crossComboMRs = combos.addonModifierResults
          .filter((amr) => amr.addon.label === ea.label && amr.result.status === 'ok')
          .map((amr) => ({ modifier_keys: amr.modifierKeys, result_noona_id: amr.result.id }))
        const existingMRKeys = new Set(existingMRs.map((r) => r.modifier_keys))
        mergedAddons.push({
          label: ea.label,
          price_diff: ea.price_diff,
          result_noona_id: ea.result_noona_id,
          modifier_results: [
            ...existingMRs,
            ...crossComboMRs.filter((r) => !existingMRKeys.has(r.modifier_keys)),
          ],
        })
      }
    }

    for (const na of newAddons) {
      if (!existingAddonMap.has(na.label)) {
        mergedAddons.push(na)
      }
    }

    const body = {
      data: {
        title: baseTitle,
        base_noona_id: baseNoonaId,
        base_price: basePrice,
        modifiers: mergedModifiers,
        base_modifier_results: mergedBMR,
        addons: mergedAddons,
      },
    }

    try {
      await StrapiAdmin.put(`/api/booking-addon-groups/${documentId}`, body)
    } catch (err) {
      console.error('[Strapi] PUT booking-addon-groups failed. Body:', JSON.stringify(body, null, 2), 'Error:', err)
      throw err
    }
    return { id: entryId }
  } else {
    const body = {
      data: {
        title: baseTitle,
        base_noona_id: baseNoonaId,
        base_price: basePrice,
        modifiers: newModifiers,
        base_modifier_results: newBaseModifierResults,
        addons: newAddons,
      },
    }
    let createRes
    try {
      createRes = await StrapiAdmin.post(`/api/booking-addon-groups`, body)
    } catch (err) {
      console.error('[Strapi] POST booking-addon-groups failed. Body:', JSON.stringify(body, null, 2), 'Error:', err)
      throw err
    }
    return { id: createRes.data?.data?.id ?? '?' }
  }
}
