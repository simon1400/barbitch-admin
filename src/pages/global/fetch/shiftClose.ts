/* eslint-disable @typescript-eslint/no-explicit-any */
import { Axios } from '../../../lib/api'
import { NoonaHQ } from '../../../lib/noona'
import { format } from 'date-fns'
import { getMoney } from '../../dashboard/fetch/costs'
import { getAdminsHours } from '../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../dashboard/fetch/allWorks'
import { splitTeam } from '../../dashboard/fetch/teamSplit'
import { invalidateGlobalMonthData } from '../../dashboard/fetch/monthDataCache'
import { diffByName } from '../components/shiftClose/helpers'

// Mirror of Strapi lifecycle (strapi/.../service-provided/lifecycles.ts).
// Kept in sync — also used to recompute flags for legacy records (verify is string).
export type VerifyFlag = 'ok' | 'sleva' | 'ztrata' | 'salon_up' | 'mistr_up' | 'mistr_down' | 'internal'

export const VERIFY_FLAGS: VerifyFlag[] = ['ok', 'internal', 'sleva', 'salon_up', 'mistr_up', 'mistr_down', 'ztrata']

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
  internal: {
    emoji: '🤝',
    label: 'Interní služba',
    chipCls: 'bg-indigo-100 text-indigo-800',
    dotCls: 'bg-indigo-500',
    severity: 0,
  },
}

// Цены хранятся строками; junior-цены (−20%) бывают с запятой ("237,6").
// Number("237,6") = NaN → 0. Нормализуем запятую перед парсом.
const toNum = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Parse discount → fraction 0..1 of the full offer price.
// Accepts percent ("20%", "20", "0.2") or an absolute amount in Kč ("400"):
// a percent can't exceed 100, so values above 100 are treated as crowns off
// the full price. Values in 1..100 stay percent ("50" = 50 %, not 50 Kč).
// Keep in sync with strapi service-provided lifecycles.ts.
const parseSaleRate = (raw: unknown, offerPrice: number): number => {
  let n = 0
  if (typeof raw === 'number') n = Number.isFinite(raw) ? raw : 0
  else if (typeof raw === 'string') {
    const m = raw.match(/(-?\d+(?:[.,]\d+)?)/)
    n = m ? parseFloat(m[1].replace(',', '.')) : 0
  }
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n <= 1) return n
  if (n <= 100) return n / 100
  return offerPrice > 0 ? Math.min(n / offerPrice, 1) : 0
}

const computeMustValues = (
  offerPrice: number,
  ratePercent: number,
  sale: unknown,
) => {
  const discountRate = parseSaleRate(sale, offerPrice)
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
  internal: boolean,
): VerifyFlag[] => {
  const { mustStaff, mustSalonNow, hasSale } = computeMustValues(offerPrice, ratePercent, sale)
  // Round to whole crowns before comparing — kills float noise (e.g. 1112*0.3 =
  // 333.59999999999997) that otherwise makes an exact 333.6 false-flag mistr_up/ztrata.
  const r = (n: number) => Math.round(n * 100) / 100

  // Internal worker-to-worker service: salon profit 0 is normal → only check master %.
  if (internal) {
    const flags: VerifyFlag[] = ['internal']
    if (r(staffSalaries) > r(mustStaff)) flags.push('mistr_up')
    if (r(staffSalaries) < r(mustStaff)) flags.push('mistr_down')
    return flags
  }

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
      toNum(item?.staffSalaries),
      toNum(item?.salonSalaries),
      item?.sale,
      Boolean(item?.internal),
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
  const staffDelta = r(toNum(item?.staffSalaries) - mustStaff)
  const salonDelta = r(toNum(item?.salonSalaries) - mustSalonNow)
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
      ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0, internal: 0,
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
      flagCounts: { ok: 0, sleva: 0, ztrata: 0, salon_up: 0, mistr_up: 0, mistr_down: 0, internal: 0 },
      unverified: 0,
      items: [],
    }
  }
}

// Fetch work-time records for a specific date (date field — exact-day match)
const fetchWorkTime = async (dateStr: string) => {
  try {
    const res = await Axios.get(
      `/api/work-times?filters[date][$eq]=${dateStr}&populate=*&pagination[pageSize]=100&status=draft`,
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

// Read the current published monthly card-profit (sum + extraIncome) for pre-filling
// the close form. Returns null if no card-profit exists yet for that month.
export const getMonthlyCardProfit = async (
  dateStr: string,
): Promise<{ sum: number; extraIncome: number } | null> => {
  const [year, month] = dateStr.split('-')
  const monthStart = `${year}-${month}-01`
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  try {
    const res = await Axios.get(
      `/api/card-profits?filters[date][$gte]=${monthStart}&filters[date][$lte]=${monthEnd}&pagination[pageSize]=1`,
    )
    const items = Array.isArray(res) ? res : []
    const cp: any = items[0]
    if (!cp) return null
    return { sum: Number(cp.sum) || 0, extraIncome: Number(cp.extraIncome) || 0 }
  } catch (e) {
    console.error('getMonthlyCardProfit error:', e)
    return null
  }
}

// Compute "Результат за месяц" from real data. When `preview` is given, the day's
// drafts + entered card values are folded in (without saving) — used for the preview.
export const fetchMonthlyResult = async (
  month: number,
  year: number,
  preview?: { day: string; cardSum: number; extraIncome: number },
) => {
  const [moneyRes, adminsRes, worksRes] = await Promise.all([
    getMoney(month, year, preview),
    getAdminsHours(month, year, preview?.day),
    getAllWorks(month, year, preview?.day),
  ])

  // Совместители (мастер+администратор) вынесены в отдельную группу. Берём итоги через
  // splitTeam, иначе корректировки совместителей задвоятся (после удаления исключений
  // sumMasters и sumAdmins оба их содержат). Инвариант splitTeam:
  // sumMasters + sumAdmins + sumCombined === старый (sumMasters + sumAdmins) →
  // результат закрытия смены численно прежний.
  const team = splitTeam(worksRes.summary, adminsRes.summary)
  const totalLabor = team.sumMasters + team.sumAdmins + team.sumCombined

  const result =
    moneyRes.cashMoney +
    moneyRes.cardExtraIncome +
    (moneyRes.cardMoney + moneyRes.qrMoney) / 1.21 -
    totalLabor -
    moneyRes.sumNoDphCosts -
    moneyRes.taxesSum

  const resultDph =
    moneyRes.cashMoney +
    moneyRes.cardMoney +
    moneyRes.qrMoney +
    moneyRes.cardExtraIncome -
    totalLabor -
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

export interface ShiftDelta {
  before: number
  after: number
  diffBefore: number
  diffAfter: number
}

// Preview the shift result BEFORE closing — same number publishShift would yield, but
// nothing is written to Strapi. Computes the monthly result as-is vs. with this day's
// drafts + the entered card values folded in.
export const previewShiftResult = async (
  dateStr: string,
  cardSum: number,
  extraIncome: number,
): Promise<ShiftDelta> => {
  const date = new Date(dateStr)
  const month = date.getMonth()
  const year = date.getFullYear()
  const [before, after] = await Promise.all([
    fetchMonthlyResult(month, year),
    fetchMonthlyResult(month, year, { day: dateStr, cardSum, extraIncome }),
  ])
  return {
    before: before.result,
    after: after.result,
    diffBefore: before.difference,
    diffAfter: after.difference,
  }
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
      return [name, item?.startTime].filter(Boolean).join(' ') || `Work-time ID ${item?.id ?? '?'}`
    }
    case 'payrolls': {
      const name = item?.personal?.name
      const sum = item?.sum ?? item?.amount
      return [name, sum != null ? `${sum} Kč` : null].filter(Boolean).join(' — ') || `Payroll ID ${item?.id ?? '?'}`
    }
    case 'card-profits':
      return `Card profit ${item?.date ?? ''}`.trim()
    case 'vouchers': {
      const idv = item?.idVoucher
      return [item?.name, idv ? `#${idv}` : null].filter(Boolean).join(' ') || `Voucher ID ${item?.id ?? '?'}`
    }
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
  'vouchers': 'Voucher',
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
    { name: 'date', type: 'date' },
    { name: 'startTime', type: 'string' },
    { name: 'endTime', type: 'string' },
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
  extraIncome: number,
): Promise<{ published: number; failures: PublishFailure[] }> => {
  const collections: { key: string; url: string }[] = [
    { key: 'cashs', url: `/api/cashs?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'services-provided', url: `/api/services-provided?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'work-times', url: `/api/work-times?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
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

  // Vouchers connected to this shift's services: stamp dateRealized = shift date
  // and publish them. Dedup by id — one voucher may cover several services. The
  // voucher relation comes from `populate=*` on services-provided.
  // 🟥 Collected into a SEPARATE phase published BEFORE the services (see execution
  // below): a voucher publish recreates the voucher's published row, so doing it
  // concurrently with a service that links to that voucher races → the FK row
  // vanishes mid-transaction → 500 on the service. Vouchers first → their published
  // rows are stable by the time the services link to them.
  const spIdx = collections.findIndex((c) => c.key === 'services-provided')
  const serviceDrafts = spIdx >= 0 ? allDrafts[spIdx] || [] : []
  const voucherMap = new Map<string, any>()
  for (const sp of serviceDrafts as any[]) {
    const v = sp?.voucher
    const vid = v?.documentId || v?.id
    if (v && vid && !voucherMap.has(String(vid))) voucherMap.set(String(vid), v)
  }
  const voucherTasks: Task[] = []
  for (const v of voucherMap.values()) {
    const id = v.documentId || v.id
    voucherTasks.push({
      collectionKey: 'vouchers',
      endpoint: `/api/vouchers/${id}?status=published`,
      item: v,
      body: { data: { dateRealized: dateStr } },
    })
  }

  // Card-profit (monthly) is handled separately because it may need POST first.
  const existing = await findMonthlyCardProfit(dateStr)
  let cardProfitItem = existing
  if (!cardProfitItem) {
    try {
      await Axios.post(`/api/card-profits`, {
        data: { sum: String(cardSum), extraIncome: String(extraIncome), date: dateStr },
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
    if (existing) {
      // Card-profit is a single monthly CUMULATIVE record this close overwrites. Save the
      // value it had BEFORE this close into prevSum/prevExtraIncome so a later revert can
      // restore the correct baseline (zeroing it broke the next close's profit math).
      // Re-closing with the same value keeps the original prev (don't clobber it).
      const curSum = Number(existing.sum) || 0
      const curExtra = Number(existing.extraIncome) || 0
      const prevSum = curSum === cardSum ? Number(existing.prevSum) || curSum : curSum
      const prevExtra =
        curExtra === extraIncome ? Number(existing.prevExtraIncome) || curExtra : curExtra
      const cpBody = {
        data: {
          sum: String(cardSum),
          extraIncome: String(extraIncome),
          date: dateStr,
          prevSum: String(prevSum),
          prevExtraIncome: String(prevExtra),
        },
      }
      // Update both versions (draft shown in Content Manager, published read by reports).
      tasks.push({
        collectionKey: 'card-profits',
        endpoint: `/api/card-profits/${id}`,
        item: cardProfitItem,
        body: cpBody,
      })
      tasks.push({
        collectionKey: 'card-profits',
        endpoint: `/api/card-profits/${id}?status=published`,
        item: cardProfitItem,
        body: cpBody,
      })
    } else {
      // Freshly POSTed record (sum/extraIncome already set, prev defaults to 0) → publish.
      tasks.push({
        collectionKey: 'card-profits',
        endpoint: `/api/card-profits/${id}?status=published`,
        item: cardProfitItem,
        body: { data: {} },
      })
    }
  }

  // Run PUTs via allSettled — collect failures without throwing. NOTE: Strapi 5 REST
  // has no transaction support and no safe "unpublish" endpoint, so we do NOT attempt
  // automatic rollback. If some succeed and some fail, the user sees the failures and
  // fixes them — a re-run skips already-published ones (not in the draft fetch).
  //
  // TWO PHASES (ordering matters): publish vouchers FIRST, await them, THEN everything
  // else. A voucher publish recreates the voucher's published row; a service that links
  // to that voucher publishing concurrently would hit the now-deleted FK row →
  // "current transaction is aborted" → 500 on the service. Serializing the voucher
  // phase ahead of the services removes the race (services link to a stable row).
  const failures: PublishFailure[] = []
  let published = 0

  const runPhase = async (phaseTasks: Task[]) => {
    const results = await Promise.allSettled(
      phaseTasks.map((t) => Axios.put(t.endpoint, t.body)),
    )
    results.forEach((res, idx) => {
      const t = phaseTasks[idx]
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
  }

  await runPhase(voucherTasks)
  await runPhase(tasks)

  // Закрытие смены изменило месячные агрегаты → сбрасываем кэш «Финансового
  // обзора»/зарплат/графиков, чтобы при следующем заходе пересчиталось свежее.
  if (published > 0) invalidateGlobalMonthData()

  return { published, failures }
}

export interface RevertResult {
  unpublished: Record<string, number>
  vouchersReverted: number
  cardProfitReset: boolean
  errors: string[]
}

// Revert a shift close: bring every published record of that day back to DRAFT
// (data preserved — never deleted) so it can be edited and re-closed.
// Unpublishing the day collections is done server-side (Strapi 5 Documents API — the
// only safe unpublish; REST DELETE would wipe the records). Voucher dateRealized is
// cleared here via the proven REST inverse of publish (keeps the voucher published).
export const revertShift = async (dateStr: string): Promise<RevertResult> => {
  const errors: string[] = []

  // 1. Clear dateRealized on vouchers attached to this day's (still published) services.
  let vouchersReverted = 0
  try {
    const res = await Axios.get(
      `/api/services-provided?filters[date][$eq]=${dateStr}&populate=voucher&pagination[pageSize]=200`,
    )
    const items = Array.isArray(res) ? res : []
    const voucherIds = new Set<string>()
    for (const sp of items as any[]) {
      const v = sp?.voucher
      const id = v?.documentId || v?.id
      if (v && id) voucherIds.add(String(id))
    }
    for (const id of voucherIds) {
      try {
        await Axios.put(`/api/vouchers/${id}?status=published`, { data: { dateRealized: null } })
        vouchersReverted++
      } catch (e) {
        errors.push(`voucher ${id}: ${extractErrorMessage(e)}`)
      }
    }
  } catch (e) {
    errors.push(`vouchers: ${extractErrorMessage(e)}`)
  }

  // 2. Restore the monthly card-profit to the value it had BEFORE this shift's close
  //    (saved in prevSum/prevExtraIncome by publishShift). Card-profit is cumulative
  //    month-to-date, so zeroing it broke the next close's profit math (the whole month's
  //    card income got counted as one shift). Restoring the previous baseline fixes that.
  let cardProfitReset = false
  try {
    const cp = await findMonthlyCardProfit(dateStr)
    if (cp) {
      const id = cp.documentId || cp.id
      const restore = {
        data: {
          sum: String(Number(cp.prevSum) || 0),
          extraIncome: String(Number(cp.prevExtraIncome) || 0),
        },
      }
      // Restore BOTH versions (draft shown in Content Manager, published read by reports).
      await Axios.put(`/api/card-profits/${id}`, restore) // draft
      await Axios.put(`/api/card-profits/${id}?status=published`, restore) // published
      cardProfitReset = true
    }
  } catch (e) {
    errors.push(`card-profit: ${extractErrorMessage(e)}`)
  }

  // 3. Server-side unpublish of the day's records (cashs / services / work-times / payrolls).
  let unpublished: Record<string, number> = {}
  try {
    const resp = (await Axios.post(`/api/shift-revert`, { date: dateStr })) as any
    unpublished = resp?.unpublished || {}
    if (Array.isArray(resp?.errors)) errors.push(...resp.errors)
  } catch (e) {
    errors.push(`unpublish: ${extractErrorMessage(e)}`)
  }

  // Реверт вернул записи в черновики / обнулил card-profit → месячные агрегаты
  // изменились, сбрасываем кэш «Финансового обзора»/зарплат/графиков.
  invalidateGlobalMonthData()

  return { unpublished, vouchersReverted, cardProfitReset, errors }
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

  // Internal worker-to-worker services never exist in Noona, so they must NOT count
  // toward the Noona↔Strapi comparison — otherwise they mask a real missing client.
  const strapiComparableItems = serviceProvided.items.filter((i: any) => !i?.internal)
  const strapiComparable = strapiComparableItems.length
  // Match by NAME, not just head-count: a wrong/typo'd client name keeps the count
  // equal (extra of one name offsets a missing other) but is a genuine discrepancy.
  const nameDiff = diffByName(strapiComparableItems, noona.events)
  const mismatchCount = nameDiff.strapiExtra.length + nameDiff.noonaExtra.length
  const comparison = {
    strapiCount: strapiComparable,
    noonaCount: noona.count,
    match: strapiComparable === noona.count && mismatchCount === 0,
    difference: mismatchCount,
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
