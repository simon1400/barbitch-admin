/* eslint-disable @typescript-eslint/no-explicit-any */
import { Axios } from '../../../lib/api'
import { NoonaHQ } from '../../../lib/noona'
import { format } from 'date-fns'
import { getMoney } from '../../dashboard/fetch/costs'
import { getAdminsHours } from '../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../dashboard/fetch/allWorks'

// Mirror of Strapi lifecycle (strapi/.../service-provided/lifecycles.ts).
// Kept in sync — also used to recompute flags for legacy records (verify is string).
export type VerifyFlag = 'ok' | 'sleva' | 'ztrata' | 'salon_up' | 'mistr_up' | 'mistr_down'

export const VERIFY_FLAGS: VerifyFlag[] = ['ok', 'sleva', 'salon_up', 'mistr_up', 'mistr_down', 'ztrata']

export interface FlagMeta {
  emoji: string
  label: string
  chipCls: string
  dotCls: string
  // severity for overall page status: 0 = ok/info, 1 = warning, 2 = error
  severity: 0 | 1 | 2
}

export const FLAG_META: Record<VerifyFlag, FlagMeta> = {
  ok: {
    emoji: '🟩',
    label: 'OK',
    chipCls: 'bg-green-100 text-green-800',
    dotCls: 'bg-green-500',
    severity: 0,
  },
  sleva: {
    emoji: '🟦',
    label: 'Sleva',
    chipCls: 'bg-blue-100 text-blue-800',
    dotCls: 'bg-blue-500',
    severity: 0,
  },
  ztrata: {
    emoji: '🟥',
    label: 'Ztráta salonu',
    chipCls: 'bg-red-100 text-red-800',
    dotCls: 'bg-red-500',
    severity: 2,
  },
  salon_up: {
    emoji: '🟪',
    label: 'Salon dostal víc',
    chipCls: 'bg-purple-100 text-purple-800',
    dotCls: 'bg-purple-500',
    severity: 1,
  },
  mistr_up: {
    emoji: '🟨↑',
    label: 'Mistr dostal víc',
    chipCls: 'bg-yellow-100 text-yellow-800',
    dotCls: 'bg-yellow-500',
    severity: 1,
  },
  mistr_down: {
    emoji: '🟨↓',
    label: 'Mistr dostal míň',
    chipCls: 'bg-amber-100 text-amber-800',
    dotCls: 'bg-amber-500',
    severity: 1,
  },
}

// Parse discount string ("20%", "0.2", "20") → fraction 0..1
const parseSaleRate = (raw: unknown): number => {
  if (raw == null) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : 0
  if (typeof raw !== 'string') return 0
  const m = raw.match(/(-?\d+(?:[.,]\d+)?)/)
  if (!m) return 0
  const n = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 1 ? n / 100 : n
}

const computeMustValues = (
  offerPrice: number,
  ratePercent: number,
  sale: unknown,
) => {
  const discountRate = parseSaleRate(sale)
  const hasSale = discountRate > 0
  const mustStaff = offerPrice * (ratePercent / 100)
  const mustSalonNow = hasSale
    ? offerPrice * (1 - discountRate) - mustStaff
    : offerPrice - mustStaff
  return { mustStaff, mustSalonNow, hasSale }
}

const computeFlagsFromValues = (
  offerPrice: number,
  ratePercent: number,
  staffSalaries: number,
  salonSalaries: number,
  sale: unknown,
): VerifyFlag[] => {
  const { mustStaff, mustSalonNow, hasSale } = computeMustValues(offerPrice, ratePercent, sale)
  // Round to whole crowns before comparing — kills float noise (e.g. 1112*0.3 =
  // 333.59999999999997) that otherwise makes an exact 333.6 false-flag mistr_up/ztrata.
  const r = (n: number) => Math.round(n * 100) / 100
  const flags: VerifyFlag[] = []
  if (r(staffSalaries) > r(mustStaff)) flags.push('mistr_up')
  if (r(staffSalaries) < r(mustStaff)) flags.push('mistr_down')
  if (r(salonSalaries) > r(mustSalonNow)) flags.push('salon_up')
  if (r(salonSalaries) < r(mustSalonNow)) flags.push('ztrata')
  if (hasSale) flags.push('sleva')
  if (flags.length === 0) flags.push('ok')
  return flags
}

// Resolve flags for a service-provided item.
// Priority: verifyFlags (new array) → recompute from offer/personal (legacy) → empty
export const getItemFlags = (item: any): VerifyFlag[] => {
  if (Array.isArray(item?.verifyFlags) && item.verifyFlags.length > 0) {
    return item.verifyFlags.filter((f: unknown): f is VerifyFlag =>
      typeof f === 'string' && (VERIFY_FLAGS as string[]).includes(f),
    )
  }
  // Legacy fallback: recompute from raw data if relations were populated
  const offerPrice = Number(item?.offer?.price)
  const ratePercent = Number(item?.personal?.ratePercent)
  if (Number.isFinite(offerPrice) && Number.isFinite(ratePercent) && offerPrice > 0) {
    return computeFlagsFromValues(
      offerPrice,
      ratePercent,
      Number(item?.staffSalaries) || 0,
      Number(item?.salonSalaries) || 0,
      item?.sale,
    )
  }
  return []
}

// Numeric delta for the given flag — used in tooltips, e.g. "+50 Kč" / "−30 Kč"
export const getFlagDelta = (item: any, flag: VerifyFlag): number | null => {
  const offerPrice = Number(item?.offer?.price)
  const ratePercent = Number(item?.personal?.ratePercent)
  if (!Number.isFinite(offerPrice) || !Number.isFinite(ratePercent) || offerPrice <= 0) return null
  const { mustStaff, mustSalonNow } = computeMustValues(offerPrice, ratePercent, item?.sale)
  const r = (n: number) => Math.round(n * 100) / 100
  const staffDelta = r((Number(item?.staffSalaries) || 0) - mustStaff)
  const salonDelta = r((Number(item?.salonSalaries) || 0) - mustSalonNow)
  switch (flag) {
    case 'salon_up': return salonDelta
    case 'ztrata':   return salonDelta
    case 'mistr_up': return staffDelta
    case 'mistr_down': return staffDelta
    case 'sleva':    return null // informational tag, no delta
    default: return null
  }
}

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface ShiftCheckResult {
  date: string
  cash: {
    found: boolean
    count: number
    items: any[]
  }
  serviceProvided: {
    found: boolean
    count: number
    flagCounts: Record<VerifyFlag, number>
    unverified: number
    items: any[]
  }
  workTime: {
    found: boolean
    count: number
    items: any[]
  }
  payroll: {
    found: boolean
    count: number
    items: any[]
  }
  noona: {
    found: boolean
    count: number
    events: any[]
  }
  comparison: {
    strapiCount: number
    noonaCount: number
    match: boolean
    difference: number
  }
}

// Fetch cash records for a specific date
const fetchCash = async (dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/cashs?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    return { found: items.length > 0, count: items.length, items }
  } catch (e) {
    console.error('fetchCash error:', e)
    return { found: false, count: 0, items: [] }
  }
}

// Fetch service-provided records for a specific date
const fetchServiceProvided = async (dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/services-provided?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    // Counters are per-flag (one item with multiple flags is counted in each)
    const flagCounts: Record<VerifyFlag, number> = {
      ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0,
    }
    let unverified = 0
    for (const i of items as any[]) {
      const flags = getItemFlags(i)
      if (flags.length === 0) {
        unverified++
        continue
      }
      for (const f of flags) flagCounts[f]++
    }
    return { found: items.length > 0, count: items.length, flagCounts, unverified, items }
  } catch (e) {
    console.error('fetchServiceProvided error:', e)
    return {
      found: false,
      count: 0,
      flagCounts: { ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0 },
      unverified: 0,
      items: [],
    }
  }
}

// Fetch work-time records for a specific date (datetime field — filter by range)
const fetchWorkTime = async (dateStr: string) => {
  try {
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`
    const res = await Axios.get(
      `/api/work-times?filters[start][$gte]=${startOfDay}&filters[start][$lte]=${endOfDay}&populate=*&pagination[pageSize]=100&status=draft`,
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    return { found: items.length > 0, count: items.length, items }
  } catch (e) {
    console.error('fetchWorkTime error:', e)
    return { found: false, count: 0, items: [] }
  }
}

// Fetch payroll records for a specific date
const fetchPayroll = async (dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/payrolls?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
    )
    const items = Array.isArray(res) ? res : (res as any)?.data || []
    return { found: items.length > 0, count: items.length, items }
  } catch (e) {
    console.error('fetchPayroll error:', e)
    return { found: false, count: 0, items: [] }
  }
}

// Fetch Noona events for a specific date
const fetchNoonaEvents = async (dateStr: string) => {
  try {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)

    const queryString = new URLSearchParams()
    queryString.append(
      'filter',
      JSON.stringify({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      }),
    )
    queryString.append('select', 'id')
    queryString.append('select', 'customer_name')
    queryString.append('select', 'status')
    queryString.append('select', 'starts_at')
    queryString.append('select', 'ends_at')
    queryString.append('select', 'event_types')
    queryString.append('select', 'employee.name')

    const res = await NoonaHQ.get(`/${COMPANY_ID}/events?${queryString.toString()}`)
    const events = res.data || []
    // Filter out cancelled and noshow
    const activeEvents = events.filter(
      (e: any) => e.status !== 'cancelled' && e.status !== 'noshow',
    )
    return { found: activeEvents.length > 0, count: activeEvents.length, events: activeEvents }
  } catch (e) {
    console.error('fetchNoonaEvents error:', e)
    return { found: false, count: 0, events: [] }
  }
}

// Find card-profit record for the month of the given date (one record per month)
const findMonthlyCardProfit = async (dateStr: string) => {
  const [year, month] = dateStr.split('-')
  const monthStart = `${year}-${month}-01`
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  // Search both published and draft
  const [published, drafts] = await Promise.all([
    Axios.get(`/api/card-profits?filters[date][$gte]=${monthStart}&filters[date][$lte]=${monthEnd}&pagination[pageSize]=1`),
    Axios.get(`/api/card-profits?filters[date][$gte]=${monthStart}&filters[date][$lte]=${monthEnd}&pagination[pageSize]=1&status=draft`),
  ])
  const pubItems = Array.isArray(published) ? published : []
  const draftItems = Array.isArray(drafts) ? drafts : []
  return draftItems[0] || pubItems[0] || null
}

// Compute "Результат за месяц" from real data
export const fetchMonthlyResult = async (month: number, year: number) => {
  const [moneyRes, adminsRes, worksRes] = await Promise.all([
    getMoney(month, year),
    getAdminsHours(month, year),
    getAllWorks(month, year),
  ])

  const result =
    moneyRes.cashMoney +
    moneyRes.cardExtraIncome +
    (moneyRes.cardMoney + moneyRes.qrMoney) / 1.21 -
    worksRes.sumMasters -
    adminsRes.sumAdmins -
    moneyRes.sumNoDphCosts -
    moneyRes.taxesSum

  const resultDph =
    moneyRes.cashMoney +
    moneyRes.cardMoney +
    moneyRes.qrMoney +
    moneyRes.cardExtraIncome -
    worksRes.sumMasters -
    adminsRes.sumAdmins -
    moneyRes.sumCosts -
    moneyRes.taxesSum

  // "Разниця" — недостача между реальными деньгами и записями (в идеале 0).
  // Та же формула, что в blockStateItems (data.ts) — блок "Разниця" на главной.
  const difference =
    moneyRes.cardMoney +
    moneyRes.cardExtraIncome +
    moneyRes.cashMoney +
    moneyRes.payrollSum +
    moneyRes.voucherRealizedSum +
    moneyRes.qrMoney -
    worksRes.globalFlow -
    moneyRes.extraMoneySum -
    moneyRes.voucherPayedSum

  return { result, resultDph, difference }
}

export interface PublishFailure {
  collection: string  // human-readable section name
  label: string       // identifier of the record (client name, master+time, etc.)
  message: string     // Strapi validation message
  documentId?: string
}

// Parse Strapi error response into a readable message.
const extractErrorMessage = (e: any): string => {
  const details = e?.response?.data?.error?.details?.errors
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((d: any) => {
        const path = Array.isArray(d?.path) ? d.path.join('.') : d?.path
        return path ? `${path}: ${d?.message ?? 'invalid'}` : (d?.message ?? 'invalid')
      })
      .join('; ')
  }
  return (
    e?.response?.data?.error?.message ||
    e?.message ||
    'Neznámá chyba'
  )
}

// Build a human label for each collection so the user can find the offending record.
const buildLabel = (collectionKey: string, item: any): string => {
  switch (collectionKey) {
    case 'services-provided':
      return [item?.clientName, item?.personal?.name].filter(Boolean).join(' — ') || `ID ${item?.id ?? '?'}`
    case 'cashs': {
      const sum = item?.sum ?? item?.amount
      return sum != null ? `Cash ${sum} Kč` : `Cash ID ${item?.id ?? '?'}`
    }
    case 'work-times': {
      const name = item?.personal?.name
      const start = item?.start ? new Date(item.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : ''
      return [name, start].filter(Boolean).join(' ') || `Work-time ID ${item?.id ?? '?'}`
    }
    case 'payrolls': {
      const name = item?.personal?.name
      const sum = item?.sum ?? item?.amount
      return [name, sum != null ? `${sum} Kč` : null].filter(Boolean).join(' — ') || `Payroll ID ${item?.id ?? '?'}`
    }
    case 'card-profits':
      return `Card profit ${item?.date ?? ''}`.trim()
    default:
      return `ID ${item?.id ?? '?'}`
  }
}

const COLLECTION_LABEL: Record<string, string> = {
  'cashs': 'Cash',
  'services-provided': 'Provedené služby',
  'work-times': 'Work-time',
  'payrolls': 'Payroll',
  'card-profits': 'Card profit',
}

// Required-field map (mirrors strapi schema.json `required: true`).
// Used for pre-flight validation so we never half-publish a shift.
type FieldType = 'string' | 'html' | 'relation' | 'array' | 'date' | 'number' | 'boolean'
const REQUIRED_FIELDS: Record<string, { name: string; type: FieldType }[]> = {
  'cashs': [
    { name: 'date', type: 'date' },
    { name: 'sum', type: 'string' },
    { name: 'profit', type: 'string' },
    { name: 'flow', type: 'array' },
  ],
  'work-times': [
    { name: 'start', type: 'date' },
    { name: 'end', type: 'date' },
    { name: 'sum', type: 'number' },
    { name: 'comment', type: 'html' },
  ],
  'payrolls': [
    { name: 'date', type: 'date' },
    { name: 'sum', type: 'number' },
  ],
  'services-provided': [
    { name: 'clientName', type: 'string' },
    { name: 'staffSalaries', type: 'string' },
    { name: 'salonSalaries', type: 'string' },
    { name: 'date', type: 'date' },
    { name: 'cash', type: 'boolean' },
    { name: 'personal', type: 'relation' },
    { name: 'offer', type: 'relation' },
  ],
}

const isEmptyHtml = (s: unknown): boolean => {
  if (typeof s !== 'string') return true
  return s.replace(/<[^>]*>/g, '').trim().length === 0
}

// Returns array of human-readable issues; empty array = record valid.
const validateDraft = (collectionKey: string, item: any): string[] => {
  const fields = REQUIRED_FIELDS[collectionKey]
  if (!fields) return []
  const issues: string[] = []
  for (const f of fields) {
    const v = item?.[f.name]
    let issue: string | null = null
    switch (f.type) {
      case 'string':
        if (v == null || (typeof v === 'string' && v.trim() === '')) issue = `${f.name}: prázdné`
        break
      case 'html':
        if (isEmptyHtml(v)) issue = `${f.name}: prázdné`
        break
      case 'relation':
        if (!v || typeof v !== 'object' || (v.id == null && v.documentId == null)) {
          issue = `${f.name}: chybí vazba`
        }
        break
      case 'array':
        if (!Array.isArray(v) || v.length === 0) issue = `${f.name}: prázdný seznam`
        break
      case 'date':
        if (!v) issue = `${f.name}: chybí`
        break
      case 'number':
        if (v == null || v === '') issue = `${f.name}: chybí`
        else if (typeof v === 'number' && !Number.isFinite(v)) issue = `${f.name}: neplatné`
        break
      case 'boolean':
        if (v == null) issue = `${f.name}: chybí`
        break
    }
    if (issue) issues.push(issue)
  }
  return issues
}

// Publish all draft records for a specific date + save/update card profit
export const publishShift = async (
  dateStr: string,
  cardSum: number,
): Promise<{ published: number; failures: PublishFailure[] }> => {
  const collections: { key: string; url: string }[] = [
    { key: 'cashs', url: `/api/cashs?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'services-provided', url: `/api/services-provided?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'work-times', url: `/api/work-times?filters[start][$gte]=${dateStr}T00:00:00.000Z&filters[start][$lte]=${dateStr}T23:59:59.999Z&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'payrolls', url: `/api/payrolls?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
  ]

  // Fetch all drafts in parallel
  const allDrafts = await Promise.all(
    collections.map(async (c) => {
      try {
        const res = await Axios.get(c.url)
        return Array.isArray(res) ? res : []
      } catch { return [] }
    }),
  )

  // PRE-FLIGHT VALIDATION — make sure every draft can be published before we touch anything.
  // Strapi REST has no transactions, so we mustn't half-publish.
  const validationFailures: PublishFailure[] = []
  allDrafts.forEach((items, collIdx) => {
    const { key } = collections[collIdx]
    items.forEach((item: any) => {
      const issues = validateDraft(key, item)
      if (issues.length > 0) {
        validationFailures.push({
          collection: COLLECTION_LABEL[key] || key,
          label: buildLabel(key, item),
          message: issues.join('; '),
          documentId: item.documentId,
        })
      }
    })
  })

  // Pre-flight failed — bail BEFORE touching anything. User fixes records in Strapi
  // and retries. This keeps the operation atomic without any risky rollback.
  if (validationFailures.length > 0) {
    return { published: 0, failures: validationFailures }
  }

  // Build a flat list of publish tasks with context attached for error reporting.
  type Task = { collectionKey: string; endpoint: string; item: any; body: any }
  const tasks: Task[] = []

  allDrafts.forEach((items, collIdx) => {
    const { key } = collections[collIdx]
    items.forEach((item: any) => {
      const id = item.documentId || item.id
      if (!id) return
      tasks.push({
        collectionKey: key,
        endpoint: `/api/${key}/${id}?status=published`,
        item,
        body: { data: {} },
      })
    })
  })

  // Card-profit (monthly) is handled separately because it may need POST first.
  const existing = await findMonthlyCardProfit(dateStr)
  let cardProfitItem = existing
  if (!cardProfitItem) {
    try {
      await Axios.post(`/api/card-profits`, {
        data: { sum: String(cardSum), date: dateStr },
      })
      cardProfitItem = await findMonthlyCardProfit(dateStr)
    } catch (e) {
      return {
        published: 0,
        failures: [{
          collection: COLLECTION_LABEL['card-profits'],
          label: `Card profit ${dateStr}`,
          message: extractErrorMessage(e),
        }],
      }
    }
  }

  if (cardProfitItem) {
    const id = cardProfitItem.documentId || cardProfitItem.id
    tasks.push({
      collectionKey: 'card-profits',
      endpoint: `/api/card-profits/${id}?status=published`,
      item: cardProfitItem,
      body: existing
        ? { data: { sum: String(cardSum), date: dateStr } }
        : { data: {} },
    })
  }

  // Run all PUTs in parallel via allSettled — collect failures without throwing.
  // NOTE: Strapi 5 REST has no transaction support and no safe "unpublish" endpoint,
  // so we do NOT attempt automatic rollback. If some succeed and some fail, user
  // sees the failures and can fix the broken records — a re-run will skip the
  // already-published ones (they won't be in the draft fetch).
  const results = await Promise.allSettled(
    tasks.map((t) => Axios.put(t.endpoint, t.body)),
  )

  const failures: PublishFailure[] = []
  let published = 0
  results.forEach((res, idx) => {
    const t = tasks[idx]
    if (res.status === 'fulfilled') {
      published++
    } else {
      failures.push({
        collection: COLLECTION_LABEL[t.collectionKey] || t.collectionKey,
        label: buildLabel(t.collectionKey, t.item),
        message: extractErrorMessage(res.reason),
        documentId: t.item?.documentId,
      })
    }
  })

  return { published, failures }
}

// Main check function — runs all checks in parallel
export const checkShift = async (date: Date): Promise<ShiftCheckResult> => {
  const dateStr = format(date, 'yyyy-MM-dd')

  const [cash, serviceProvided, workTime, payroll, noona] = await Promise.all([
    fetchCash(dateStr),
    fetchServiceProvided(dateStr),
    fetchWorkTime(dateStr),
    fetchPayroll(dateStr),
    fetchNoonaEvents(dateStr),
  ])

  const comparison = {
    strapiCount: serviceProvided.count,
    noonaCount: noona.count,
    match: serviceProvided.count === noona.count,
    difference: Math.abs(serviceProvided.count - noona.count),
  }

  return {
    date: dateStr,
    cash,
    serviceProvided,
    workTime,
    payroll,
    noona,
    comparison,
  }
}
