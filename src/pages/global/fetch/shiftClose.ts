/* eslint-disable @typescript-eslint/no-explicit-any */
import { Axios } from '../../../lib/api'
import { NoonaHQ } from '../../../lib/noona'
import { format } from 'date-fns'
import { getMoney } from '../../dashboard/fetch/costs'
import { getAdminsHours } from '../../dashboard/fetch/allAdminsHours'
import { getAllWorks } from '../../dashboard/fetch/allWorks'

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
    verified: number
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
    const verified = items.filter((i: any) => i.verify && i.verify !== '' && i.verify !== 'false').length
    const unverified = items.length - verified
    return { found: items.length > 0, count: items.length, verified, unverified, items }
  } catch (e) {
    console.error('fetchServiceProvided error:', e)
    return { found: false, count: 0, verified: 0, unverified: 0, items: [] }
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

  return { result, resultDph }
}

// Publish all draft records for a specific date + save/update card profit
export const publishShift = async (dateStr: string, cardSum: number) => {
  const collections = [
    { url: `/api/cashs?filters[date][$eq]=${dateStr}&status=draft&pagination[pageSize]=100` },
    { url: `/api/services-provided?filters[date][$eq]=${dateStr}&status=draft&pagination[pageSize]=100` },
    { url: `/api/work-times?filters[start][$gte]=${dateStr}T00:00:00.000Z&filters[start][$lte]=${dateStr}T23:59:59.999Z&status=draft&pagination[pageSize]=100` },
    { url: `/api/payrolls?filters[date][$eq]=${dateStr}&status=draft&pagination[pageSize]=100` },
  ]

  const endpoints = [
    '/api/cashs',
    '/api/services-provided',
    '/api/work-times',
    '/api/payrolls',
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

  // Publish each draft record
  const publishPromises: Promise<any>[] = []
  allDrafts.forEach((items, collIdx) => {
    items.forEach((item: any) => {
      const id = item.documentId || item.id
      if (id) {
        publishPromises.push(
          Axios.put(`${endpoints[collIdx]}/${id}?status=published`, { data: {} }),
        )
      }
    })
  })

  // Update monthly card-profit record and publish
  const existing = await findMonthlyCardProfit(dateStr)

  if (existing) {
    const id = existing.documentId || existing.id
    publishPromises.push(
      Axios.put(`/api/card-profits/${id}?status=published`, {
        data: { sum: String(cardSum), date: dateStr },
      }),
    )
  } else {
    await Axios.post(`/api/card-profits`, {
      data: { sum: String(cardSum), date: dateStr },
    })
    const created = await findMonthlyCardProfit(dateStr)
    if (created) {
      const id = created.documentId || created.id
      publishPromises.push(
        Axios.put(`/api/card-profits/${id}?status=published`, { data: {} }),
      )
    }
  }

  await Promise.all(publishPromises)
  return { published: publishPromises.length }
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
