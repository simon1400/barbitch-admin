import axios from 'axios'
import { NoonaHQ, NoonaHQBase } from '../../../lib/noona'
import { calcJuniorPrice, calcJuniorDuration } from '../../../constants/junior'

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
  duration: number
  price: number
}

export interface NoonaCategory {
  id: string
  title: string
  serviceIds: string[]
}

export interface JuniorMap {
  documentId?: string
  senior_noona_id: string
  junior_noona_id: string
  title?: string
  senior_price?: number
  junior_price?: number
}

export interface PlannedJunior {
  key: string // = senior_noona_id
  seniorId: string
  seniorTitle: string
  seniorPrice: number
  juniorPrice: number
  duration: number
  excluded: boolean // disabled by exclusion rule
  exclusionReason?: string
  selected: boolean // checkbox state
}

export interface GenerateResult {
  plan: PlannedJunior
  status: 'ok' | 'error' | 'skipped'
  juniorId?: string
  error?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Услуги/варианты которые НЕ переносить в junior (по подстроке в title, case-insensitive)
export const DEFAULT_EXCLUSION_PATTERNS = ['babyboomer', 'kitty', 'korekce']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getErr = (err: unknown): string => {
  const e = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string }
  return (
    e?.response?.data?.error?.message ??
    e?.response?.data?.message ??
    e?.message ??
    'Неизвестная ошибка'
  )
}

const matchesExclusion = (title: string, patterns: string[]): string | undefined => {
  const lower = title.toLowerCase()
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) return p
  }
  return undefined
}

let cachedVatId: string | null = null

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

// ─── Bulk fetch ──────────────────────────────────────────────────────────────

export const fetchAllNoonaEventTypes = async (): Promise<NoonaEventType[]> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/event_types?expand[]=variations.prices`)
  const items: Array<{
    id?: string
    title?: string
    duration?: number
    connections?: { hidden?: boolean }
    variations?: Array<{ prices?: Array<{ amount?: number }> }>
  }> = Array.isArray(res.data) ? res.data : []

  return items
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id!,
      title: s.title ?? '(без названия)',
      hidden: Boolean(s.connections?.hidden),
      duration: s.duration ?? 60,
      price: s.variations?.[0]?.prices?.[0]?.amount ?? 0,
    }))
}

export const fetchAllNoonaCategories = async (): Promise<NoonaCategory[]> => {
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

export const fetchExistingJuniorMaps = async (): Promise<JuniorMap[]> => {
  const all: JuniorMap[] = []
  let page = 1
  while (true) {
    const res = await StrapiAdmin.get(
      `/api/service-junior-maps?pagination[page]=${page}&pagination[pageSize]=200`,
    )
    const data: Array<{
      id?: number
      documentId?: string
      senior_noona_id?: string
      junior_noona_id?: string
      title?: string
      senior_price?: number
      junior_price?: number
    }> = res.data?.data ?? []
    const meta = res.data?.meta?.pagination
    for (const item of data) {
      if (item.senior_noona_id && item.junior_noona_id) {
        all.push({
          documentId: item.documentId,
          senior_noona_id: item.senior_noona_id,
          junior_noona_id: item.junior_noona_id,
          title: item.title,
          senior_price: item.senior_price,
          junior_price: item.junior_price,
        })
      }
    }
    if (!meta || page >= meta.pageCount || data.length === 0) break
    page++
  }
  return all
}

// ─── Plan building ───────────────────────────────────────────────────────────

export interface BuildPlanInput {
  sourceCategoryId: string
  eventTypes: NoonaEventType[]
  categories: NoonaCategory[]
  existingJuniorMaps: JuniorMap[]
  exclusionPatterns: string[]
}

export const buildPlan = (input: BuildPlanInput): PlannedJunior[] => {
  const { sourceCategoryId, eventTypes, categories, existingJuniorMaps, exclusionPatterns } = input

  const cat = categories.find((c) => c.id === sourceCategoryId)
  if (!cat) return []

  const inScope = new Set(cat.serviceIds)
  const alreadyMapped = new Set(existingJuniorMaps.map((m) => m.senior_noona_id))
  const etById = new Map(eventTypes.map((et) => [et.id, et]))

  const plan: PlannedJunior[] = []
  for (const id of inScope) {
    const et = etById.get(id)
    if (!et) continue
    if (alreadyMapped.has(id)) continue // already has junior copy
    const exclusion = matchesExclusion(et.title, exclusionPatterns)
    plan.push({
      key: id,
      seniorId: id,
      seniorTitle: et.title,
      seniorPrice: et.price,
      juniorPrice: calcJuniorPrice(et.price),
      duration: et.duration,
      excluded: Boolean(exclusion),
      exclusionReason: exclusion,
      selected: !exclusion && et.price > 0, // skip 0-price (Korekce) by default
    })
  }
  return plan.sort((a, b) => a.seniorTitle.localeCompare(b.seniorTitle, 'cs'))
}

// ─── Create one junior copy in Noona + Strapi map ────────────────────────────

// Creates a junior event_type in Noona WITHOUT assigning a category (caller does it).
// ⚠️ Junior копии создаются visible (hidden=false) — это критично!
// hidden=true блокирует слоты в marketplace API (/time_slots не отдаёт hidden).
// Из публичного списка /book + /cenik + /service/* они фильтруются Strapi-side
// через getJuniorNoonaIds() (см. service-junior-map). См. memory junior-master-pricing.md
const createJuniorEventTypeRaw = async (
  seniorTitle: string,
  duration: number,
  juniorPrice: number,
): Promise<string> => {
  const vatId = await getVatId()
  const body: Record<string, unknown> = {
    company: COMPANY_ID,
    title: seniorTitle,
    duration,
    color: '#9B7EE8',
    variations: [{ prices: [{ amount: juniorPrice, currency: 'CZK' }] }],
    connections: {
      hidden: false,
      customer_selects: 'employee',
      service_needs: 'employee',
    },
  }
  if (vatId) body.vat = vatId
  const res = await NoonaHQBase.post(`/event_types`, body)
  const newId: string = res.data?.id ?? res.data?._id ?? ''
  if (!newId) throw new Error('Noona не вернула ID нового event_type')
  return newId
}

const createJuniorEventType = async (
  seniorTitle: string,
  duration: number,
  juniorPrice: number,
  _isHiddenSource: boolean,
  // ⚠️ Junior copies are NOT added to a Noona category anymore. They stay visible
  // (bookable from the site by junior_noona_id) but ungrouped, so they don't bloat
  // Noona's native customer booking listing. "Who is junior" lives in Strapi
  // (service-junior-map + personal.tier), category membership is not needed.
  _targetCategoryId: string,
): Promise<string> => {
  return createJuniorEventTypeRaw(seniorTitle, duration, juniorPrice)
}

const saveJuniorMap = async (map: {
  senior_noona_id: string
  junior_noona_id: string
  title: string
  senior_price: number
  junior_price: number
}): Promise<void> => {
  await StrapiAdmin.post(`/api/service-junior-maps`, { data: map })
}

export const generateOne = async (
  plan: PlannedJunior,
  targetCategoryId: string,
  isHiddenSource: boolean,
): Promise<GenerateResult> => {
  if (plan.excluded || !plan.selected) {
    return { plan, status: 'skipped' }
  }
  try {
    const juniorId = await createJuniorEventType(
      plan.seniorTitle,
      calcJuniorDuration(plan.duration), // junior takes longer than senior (+markup, →5 min)
      plan.juniorPrice,
      isHiddenSource,
      targetCategoryId,
    )
    await saveJuniorMap({
      senior_noona_id: plan.seniorId,
      junior_noona_id: juniorId,
      title: plan.seniorTitle,
      senior_price: plan.seniorPrice,
      junior_price: plan.juniorPrice,
    })
    return { plan, status: 'ok', juniorId }
  } catch (err) {
    return { plan, status: 'error', error: getErr(err) }
  }
}

export const generateAll = async (
  plans: PlannedJunior[],
  targetCategoryId: string,
  eventTypes: NoonaEventType[],
  onProgress?: (done: number, total: number) => void,
): Promise<GenerateResult[]> => {
  const etById = new Map(eventTypes.map((et) => [et.id, et]))
  const toProcess = plans.filter((p) => p.selected && !p.excluded)
  const results: GenerateResult[] = []
  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]
    const sourceEt = etById.get(p.seniorId)
    const isHidden = Boolean(sourceEt?.hidden)
    const r = await generateOne(p, targetCategoryId, isHidden)
    results.push(r)
    onProgress?.(i + 1, toProcess.length)
  }
  return results
}

// ─── Create junior copies for an explicit list of senior services ─────────────
// Used by the "Pridat +" form to make junior (-20%) versions of the base service
// and every combo it just created, all dropped into one chosen junior category.

export interface JuniorCopyInput {
  senior_noona_id: string
  title: string
  senior_price: number
  duration: number
}

export interface JuniorCopyResult {
  senior_noona_id: string
  title: string
  status: 'ok' | 'error' | 'skipped'
  junior_noona_id?: string
  junior_price?: number
  error?: string
}

export const createJuniorCopies = async (
  inputs: JuniorCopyInput[],
  // ⚠️ Kept for signature compatibility but no longer used — junior copies are
  // intentionally left ungrouped (see createJuniorEventType). They stay visible and
  // bookable by junior_noona_id but don't show in Noona's native booking listing.
  _targetCategoryId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<JuniorCopyResult[]> => {
  // Skip seniors that already have a junior copy (idempotent re-runs)
  const existing = await fetchExistingJuniorMaps()
  const mapped = new Set(existing.map((m) => m.senior_noona_id))

  const results: JuniorCopyResult[] = []
  let done = 0

  for (const input of inputs) {
    if (mapped.has(input.senior_noona_id)) {
      results.push({ senior_noona_id: input.senior_noona_id, title: input.title, status: 'skipped' })
      done++
      onProgress?.(done, inputs.length)
      continue
    }
    const juniorPrice = calcJuniorPrice(input.senior_price)
    // Junior takes longer than senior — apply the time markup (+%, rounded to 5 min).
    const juniorDuration = calcJuniorDuration(input.duration)
    try {
      const juniorId = await createJuniorEventTypeRaw(input.title, juniorDuration, juniorPrice)
      await saveJuniorMap({
        senior_noona_id: input.senior_noona_id,
        junior_noona_id: juniorId,
        title: input.title,
        senior_price: input.senior_price,
        junior_price: juniorPrice,
      })
      mapped.add(input.senior_noona_id)
      results.push({
        senior_noona_id: input.senior_noona_id,
        title: input.title,
        status: 'ok',
        junior_noona_id: juniorId,
        junior_price: juniorPrice,
      })
    } catch (err) {
      results.push({
        senior_noona_id: input.senior_noona_id,
        title: input.title,
        status: 'error',
        error: getErr(err),
      })
    }
    done++
    onProgress?.(done, inputs.length)
  }

  return results
}
