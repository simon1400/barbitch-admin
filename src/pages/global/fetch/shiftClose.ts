/* eslint-disable @typescript-eslint/no-explicit-any */
import { monthEndYmd, ymdToDate } from '../../../utils/date'
import { Axios } from '../../../lib/api'
import { format } from 'date-fns'
import { getMoney } from '../../dashboard/fetch/costs'
import { getAdminsHours } from '../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../dashboard/fetch/allWorks'
import { splitTeam } from '../../dashboard/fetch/teamSplit'
import { invalidateGlobalMonthData } from '../../dashboard/fetch/monthDataCache'
import { computeShiftDiff } from '../components/shiftClose/helpers'
import {
  authCfg,
  fetchCalendarBookings,
  fetchCurrentClientNames,
  fetchDayDraftsOf,
  fetchServiceProvided,
  fetchUpsellCommissions,
  findMonthlyCardProfit,
  upsellCommissionsUrl,
} from './shift/drafts'
import { isEnginePayrollItem } from '../../../lib/internalPayroll'
import { gateInternalPayrolls, gateUpsellCommissions } from './shift/publishGates'
import { korekceCarryover } from './shift/korekceCarryover'
export { korekceCarryover } from './shift/korekceCarryover'
import {
  COLLECTION_LABEL,
  buildLabel,
  extractErrorMessage,
  validateDraft,
  type PublishFailure,
} from './shift/validate'
// Реэкспорт публичной поверхности: эти имена импортируют ИЗ shiftClose
// (ServiceProvidedCard — флаги, PublishSection и ShiftClosePage — PublishFailure).
export { getItemFlags, getFlagDelta } from './shift/flags'
export type { PublishFailure } from './shift/validate'

// Verify-флаги (метаданные + разбор скидки) живут в отдельном лёгком модуле
// lib/verifyFlags — их переиспользует и drawer календаря, которому весь shiftClose
// (mirror + dashboard-фетчи) в чанк не нужен. Реэкспорт — чтобы существующие
// импорты из shiftClose продолжали работать.
// sleva_bez_karty (K4): информационный — у записи есть скидка, но у клиента в этот
// день нет погашенной награды bitchcard. Считается ТОЛЬКО в Strapi (нужен lookup
// брони/redemption) — клиентские пересчёты ниже его просто не добавляют.
export type { VerifyFlag } from '../../../lib/verifyFlags'
export { VERIFY_FLAGS, FLAG_META } from '../../../lib/verifyFlags'
import { type VerifyFlag } from '../../../lib/verifyFlags'

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
  // комиссии администраторов за дозаписи (черновики add-money, source=upsell), s197
  upsell: {
    found: boolean
    count: number
    items: any[]
  }
  // списания с зарплаты за интерные услуги (черновики payroll, source=internal), s203
  internalPayroll: {
    found: boolean
    count: number
    items: any[]
  }
  calendar: {
    found: boolean
    count: number
    events: any[]
  }
  comparison: {
    strapiCount: number
    calendarCount: number
    match: boolean
    difference: number
  }
  // 🟥 Сбой любой из пяти выборок раньше выглядел как «записей за день нет»:
  // каждая ловила исключение и возвращала пустой список, сверка сходилась на
  // пустоте, и смену можно было закрыть по неполным данным. Теперь причина
  // доезжает до страницы, которая блокирует публикацию.
  errors: string[]
}

export const getMonthlyCardProfit = async (
  dateStr: string,
): Promise<{ sum: number; extraIncome: number } | null> => {
  const [year, month] = dateStr.split('-')
  const monthStart = `${year}-${month}-01`
  const monthEnd = monthEndYmd(Number(year), Number(month) - 1)
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
  const team = splitTeam(worksRes.summary, adminsRes.summary, `${year}-${String(month + 1).padStart(2, '0')}`)
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
  // черновики «Оказанных услуг» дня — для поправки на перенос доли коррекции (s210)
  dayItems: any[] = [],
): Promise<ShiftDelta> => {
  // 🟥 Было `new Date(dateStr)` — это полночь UTC, а месяц читался локальными
  // getMonth/getFullYear. В отрицательном часовом поясе первое число месяца
  // давало ПРЕДЫДУЩИЙ месяц, и владелец видел дельту не того месяца (s186).
  const date = ymdToDate(dateStr)
  const month = date.getMonth()
  const year = date.getFullYear()
  const [before, after, carry] = await Promise.all([
    fetchMonthlyResult(month, year),
    fetchMonthlyResult(month, year, { day: dateStr, cardSum, extraIncome }),
    korekceCarryover(dayItems),
  ])
  return {
    before: before.result + carry.result,
    after: after.result,
    diffBefore: before.difference + carry.difference,
    diffAfter: after.difference,
  }
}

export const publishShift = async (
  dateStr: string,
  cardSum: number,
  extraIncome: number,
): Promise<{ published: number; failures: PublishFailure[]; skipped: PublishFailure[] }> => {
  const collections: { key: string; url: string }[] = [
    { key: 'cashs', url: `/api/cashs?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'services-provided', url: `/api/services-provided?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'work-times', url: `/api/work-times?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    { key: 'payrolls', url: `/api/payrolls?filters[date][$eq]=${dateStr}&status=draft&populate=*&pagination[pageSize]=100` },
    // комиссии за дозаписи (s197): публикуются ТОЛЬКО у закрытых визитов
    { key: 'add-moneys', url: upsellCommissionsUrl(dateStr) },
  ]

  // Fetch all drafts in parallel. authHeaders обязательны: без токена pre-flight
  // не увидел бы relation `booking` (санитизация Public-роли) и ложно завалил бы
  // записи чекаута из календаря на правиле «offer/booking».
  const allDrafts: any[][] = await Promise.all(
    collections.map(async (c) => {
      try {
        const res = await Axios.get(c.url, authCfg())
        return Array.isArray(res) ? res : []
      } catch { return [] }
    }),
  )

  // Условные черновики (комиссии за дозаписи s197, списания за интерные услуги s203)
  // публикуются только у состоявшихся визитов; остальные уходят в `skipped` и смену
  // не блокируют. Само правило — в shift/publishGates.
  const skipped: PublishFailure[] = []
  const amIdx = collections.findIndex((c) => c.key === 'add-moneys')
  if (amIdx >= 0) allDrafts[amIdx] = gateUpsellCommissions(allDrafts[amIdx], skipped)
  const prIdx = collections.findIndex((c) => c.key === 'payrolls')
  if (prIdx >= 0) allDrafts[prIdx] = gateInternalPayrolls(allDrafts[prIdx], skipped)

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
    return { published: 0, failures: validationFailures, skipped }
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
        skipped,
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

  return { published, failures, skipped }
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

  const [cash, serviceProvided, workTime, payrollAll, calendar, upsell] = await Promise.all([
    fetchDayDraftsOf('cashs', 'pokladna', dateStr),
    fetchServiceProvided(dateStr),
    fetchDayDraftsOf('work-times', 'pracovní doba', dateStr),
    fetchDayDraftsOf('payrolls', 'výplaty', dateStr),
    fetchCalendarBookings(dateStr),
    fetchUpsellCommissions(dateStr),
  ])

  // Списания за интерные услуги (s203) выделяем из ТОГО ЖЕ ответа: черновики дня
  // приходят с populate=*, то есть уже с `source` и связью `booking`. Второй круг
  // к той же коллекции был бы лишним запросом и сломал бы инвариант стенда
  // «черновики дня запрошены по одному разу».
  // В общей карточке «Výplaty» интерные больше не показываем — у них своя
  // карточка с гейтом по статусу визита, иначе одна запись висела бы дважды.
  const allPayrollItems: any[] = payrollAll.items || []
  // s210: сюда же списания за бесплатные коррекции (source=korekce) — тот же гейт
  const internalItems = allPayrollItems.filter((i) => isEnginePayrollItem(i))
  const manualItems = allPayrollItems.filter((i) => !isEnginePayrollItem(i))
  const payroll = { ...payrollAll, found: manualItems.length > 0, count: manualItems.length, items: manualItems }
  const internalPayroll = {
    found: internalItems.length > 0,
    count: internalItems.length,
    items: internalItems,
  }

  // Internal worker-to-worker services are booked through the calendar too (walk-in
  // booking + "Interní" flag), so ALL records count toward the calendar↔Strapi comparison.
  const strapiComparableItems = serviceProvided.items
  const strapiComparable = strapiComparableItems.length
  // V3: сначала СТРУКТУРНО по service-provided.booking, остаток — по именам клиентов
  // (legacy-записи без линка). Имя-матчинг нужен и потому, что неверное имя держит
  // счётчик равным (лишний одного имени гасит недостающего другого).
  let events = calendar.events
  let diff = computeShiftDiff(strapiComparableItems, events)

  // Safety net for name typos: if a NAME-based leftover remains on BOTH sides, refresh
  // the bookings' names from the client collection (via event.customer) and re-match.
  // Patched events flow into the result so the comparison, offer-match and the
  // bookings list all show current names. При полном структурном матче не нужен.
  if (diff.nameMismatch) {
    const nameById = await fetchCurrentClientNames()
    if (nameById.size > 0) {
      events = events.map((e: any) => {
        const current = e.customer ? nameById.get(e.customer) : undefined
        return current && current !== e.customer_name
          ? { ...e, customer_name: current }
          : e
      })
      diff = computeShiftDiff(strapiComparableItems, events)
    }
  }

  const mismatchCount = diff.strapiExtra.length + diff.calendarExtra.length
  const comparison = {
    strapiCount: strapiComparable,
    calendarCount: calendar.count,
    match: strapiComparable === calendar.count && mismatchCount === 0,
    difference: mismatchCount,
  }

  const errors = [
    (cash as any).error,
    (serviceProvided as any).error,
    (workTime as any).error,
    (payroll as any).error,
    (calendar as any).error,
    (upsell as any).error,
  ].filter(Boolean) as string[]

  return {
    date: dateStr,
    cash,
    serviceProvided,
    workTime,
    payroll,
    upsell,
    internalPayroll,
    calendar: { ...calendar, events },
    comparison,
    errors,
  }
}
