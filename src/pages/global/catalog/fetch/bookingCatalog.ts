// Data-слой редактора собственного каталога услуг (salon-service, own-booking шаг 6.2).
// Обычный Strapi REST: GET с явным Bearer VITE_STRAPI_TOKEN (Public-прав у коллекции нет),
// мутации через Axios (интерсептор сам подставляет токен на POST/PUT/DELETE).
// ⚠️ Каталог живой: движок /engine/* читает эти же записи — правки сразу видны на сайте.

import { Axios } from '../../../../lib/api'

const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const strapiHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined

export interface CatalogVariant {
  label: string
  priceDiff: number
  durationDiff: number
  description: string
}

export interface CatalogModifier {
  key: string
  label: string
  priceDiff: number
  durationDiff: number
  group: string
  description: string
}

export interface CatalogServiceFull {
  documentId: string
  title: string
  category: string
  categoryOrder: number
  order: number
  price: number
  durationMin: number
  description: string
  active: boolean
  onlineBookable: boolean
  variants: CatalogVariant[]
  modifiers: CatalogModifier[]
  // мастера, назначенные на услугу (дедуп по documentId — relation целится
  // в draft+published строки personal и populate может отдать дубль)
  personalDocIds: string[]
}

export interface MasterOption {
  documentId: string
  name: string
  tier: 'senior' | 'junior'
  serviceDocIds: string[] // текущие услуги мастера (для диффа при сохранении)
}

const SERVICE_POPULATE =
  'populate[variants]=true&populate[modifiers]=true&populate[personals][fields][0]=name&populate[personals][fields][1]=tier'

interface RawVariant {
  label?: string
  priceDiff?: number
  durationDiff?: number
  description?: string
}

interface RawModifier extends RawVariant {
  key?: string
  group?: string
}

interface RawDocRef {
  documentId: string
  name?: string
  tier?: string
}

interface RawService {
  documentId: string
  title?: string
  category?: string
  categoryOrder?: number
  order?: number
  price?: number
  durationMin?: number
  description?: string
  active?: boolean
  onlineBookable?: boolean
  variants?: RawVariant[]
  modifiers?: RawModifier[]
  personals?: RawDocRef[]
}

interface RawPersonal extends RawDocRef {
  services?: RawDocRef[]
}

const mapVariant = (v: RawVariant): CatalogVariant => ({
  label: v?.label ?? '',
  priceDiff: Number(v?.priceDiff ?? 0),
  durationDiff: Number(v?.durationDiff ?? 0),
  description: v?.description ?? '',
})

const mapModifier = (m: RawModifier): CatalogModifier => ({
  key: m?.key ?? '',
  label: m?.label ?? '',
  priceDiff: Number(m?.priceDiff ?? 0),
  durationDiff: Number(m?.durationDiff ?? 0),
  group: m?.group ?? '',
  description: m?.description ?? '',
})

const mapService = (item: RawService): CatalogServiceFull => ({
  documentId: item.documentId,
  title: item.title ?? '',
  category: item.category ?? '',
  categoryOrder: Number(item.categoryOrder ?? 0),
  order: Number(item.order ?? 0),
  price: Number(item.price ?? 0),
  durationMin: Number(item.durationMin ?? 0),
  description: item.description ?? '',
  active: item.active !== false,
  onlineBookable: item.onlineBookable !== false,
  variants: (item.variants ?? []).map(mapVariant),
  modifiers: (item.modifiers ?? []).map(mapModifier),
  personalDocIds: [...new Set((item.personals ?? []).map((p) => p.documentId))],
})

export const fetchCatalogServices = async (): Promise<CatalogServiceFull[]> => {
  const data = (await Axios.get(
    `/api/salon-services?${SERVICE_POPULATE}&sort[0]=categoryOrder:asc&sort[1]=order:asc&sort[2]=title:asc&pagination[pageSize]=200`,
    { headers: strapiHeaders },
  )) as unknown as RawService[]
  return (data || []).map(mapService)
}

export const fetchMasterOptions = async (): Promise<MasterOption[]> => {
  const data = (await Axios.get(
    '/api/personals?fields[0]=name&fields[1]=tier&filters[position][$eq]=master&filters[isActive][$eq]=true&populate[services][fields][0]=title&status=published&pagination[pageSize]=100&sort=name:asc',
    { headers: strapiHeaders },
  )) as unknown as RawPersonal[]
  return (data || []).map((p) => ({
    documentId: p.documentId,
    name: p.name ?? '',
    tier: p.tier === 'junior' ? 'junior' : 'senior',
    serviceDocIds: [...new Set((p.services ?? []).map((s) => s.documentId))],
  }))
}

// ── сохранение услуги ──

export interface ServicePayload {
  title: string
  category: string
  categoryOrder: number
  order: number
  price: number
  durationMin: number
  description: string
  active: boolean
  onlineBookable: boolean
  variants: CatalogVariant[]
  modifiers: CatalogModifier[]
}

// Ключ нового модификатора — слаг из label (канон toKey s49/s53: lowercase,
// пробелы → дефисы, диакритика сохраняется). Существующие держат сохранённый key.
export const toModifierKey = (label: string): string => label.toLowerCase().trim().replace(/\s+/g, '-')

const toData = (p: ServicePayload) => ({
  title: p.title.trim(),
  category: p.category.trim(),
  categoryOrder: p.categoryOrder,
  order: p.order,
  price: p.price,
  durationMin: p.durationMin,
  description: p.description.trim(),
  active: p.active,
  onlineBookable: p.onlineBookable,
  variants: p.variants.map((v) => ({
    label: v.label.trim(),
    priceDiff: v.priceDiff,
    durationDiff: v.durationDiff,
    description: v.description.trim(),
  })),
  modifiers: p.modifiers.map((m) => ({
    key: (m.key || toModifierKey(m.label)).trim(),
    label: m.label.trim(),
    priceDiff: m.priceDiff,
    durationDiff: m.durationDiff,
    group: m.group.trim(),
    description: m.description.trim(),
  })),
})

export const updateService = async (documentId: string, payload: ServicePayload): Promise<void> => {
  await Axios.put(`/api/salon-services/${documentId}`, { data: toData(payload) })
}

export const createService = async (payload: ServicePayload): Promise<string> => {
  const created = (await Axios.post('/api/salon-services', {
    data: toData(payload),
  })) as unknown as { documentId?: string }
  return created?.documentId ?? ''
}

// ── назначение мастеров ──
// Owning-сторона relation — personal.services → пишем со стороны мастера, в ОБЕ
// версии (draft + published), как salon_service_migrate.mjs: движок читает
// published personals. ⚠️ PUT ?status=published публикует текущий драфт personal.

export const setMasterServices = async (
  personalDocId: string,
  serviceDocIds: string[],
): Promise<void> => {
  await Axios.put(`/api/personals/${personalDocId}`, { data: { services: serviceDocIds } })
  await Axios.put(`/api/personals/${personalDocId}?status=published`, {
    data: { services: serviceDocIds },
  })
}

/**
 * Применить выбор мастеров для услуги: для каждого мастера, чьё членство
 * изменилось, пересобирается его список услуг (add/remove serviceDocId).
 */
export const applyMasterAssignment = async (
  serviceDocId: string,
  selectedMasterIds: Set<string>,
  masters: MasterOption[],
): Promise<number> => {
  let changed = 0
  for (const m of masters) {
    const has = m.serviceDocIds.includes(serviceDocId)
    const wants = selectedMasterIds.has(m.documentId)
    if (has === wants) continue
    const next = wants
      ? [...m.serviceDocIds, serviceDocId]
      : m.serviceDocIds.filter((id) => id !== serviceDocId)
    await setMasterServices(m.documentId, next)
    changed += 1
  }
  return changed
}
