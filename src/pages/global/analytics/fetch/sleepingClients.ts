import { NoonaHQ } from '../../../../lib/noona'
import {
  getEventsHistory,
  fetchEmployeeNames,
  isAttended,
  isActive,
  todayStr,
} from './eventsHistory'

// «Спящие клиенты» — ходили, но давно не были и НЕ имеют будущей брони.
// Контакты из Noona customers (отдаются все одним запросом, ~1700 шт.),
// визиты/деньги/последний мастер считаем сами из истории событий
// (поле last_event у customers не используем — его семантика не документирована).

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

interface RawCustomer {
  id?: string
  name?: string
  email?: string
  phone_country_code?: string
  phone_number?: string
}

export interface SleepingClient {
  customerId: string
  name: string
  phone: string // '+420739505998' или ''
  email: string
  visits: number
  lastVisit: string // 'YYYY-MM-DD'
  daysSince: number
  lastMaster: string
  spent: number // Kč, сумма цен состоявшихся визитов
}

const fetchCustomers = async (): Promise<RawCustomer[]> => {
  const params = new URLSearchParams()
  for (const f of ['id', 'name', 'email', 'phone_country_code', 'phone_number']) {
    params.append('select', f)
  }
  const res = await NoonaHQ.get<RawCustomer[]>(`/${COMPANY_ID}/customers?${params.toString()}`)
  return Array.isArray(res.data) ? res.data : []
}

const formatPhone = (c: RawCustomer): string => {
  if (!c.phone_number) return ''
  const code = c.phone_country_code ? `+${c.phone_country_code}` : ''
  return `${code}${c.phone_number}`
}

// Все клиенты с историей (фильтрация по порогам — в UI, мгновенно)
export const getSleepingCandidates = async (force = false): Promise<SleepingClient[]> => {
  const [events, customers, empNames] = await Promise.all([
    getEventsHistory(force),
    fetchCustomers(),
    fetchEmployeeNames(),
  ])
  const today = todayStr()

  interface Acc {
    visits: number
    lastVisit: string
    lastMaster: string
    spent: number
    hasFuture: boolean
  }
  const byCustomer = new Map<string, Acc>()

  for (const e of events) {
    if (!e.customer) continue
    let acc = byCustomer.get(e.customer)
    if (!acc) {
      acc = { visits: 0, lastVisit: '', lastMaster: '', spent: 0, hasFuture: false }
      byCustomer.set(e.customer, acc)
    }
    if (e.date > today) {
      if (isActive(e)) acc.hasFuture = true
      continue
    }
    if (!isAttended(e)) continue
    acc.visits++
    acc.spent += e.price
    if (e.date >= acc.lastVisit) {
      acc.lastVisit = e.date
      acc.lastMaster = empNames.get(e.employee) ?? ''
    }
  }

  const msDay = 24 * 60 * 60 * 1000
  const now = new Date().getTime()
  const result: SleepingClient[] = []

  for (const c of customers) {
    if (!c.id) continue
    const acc = byCustomer.get(c.id)
    if (!acc || acc.visits === 0 || acc.hasFuture) continue
    const [y, m, d] = acc.lastVisit.split('-').map(Number)
    const daysSince = Math.floor((now - new Date(y, m - 1, d).getTime()) / msDay)
    result.push({
      customerId: c.id,
      name: c.name ?? '—',
      phone: formatPhone(c),
      email: c.email ?? '',
      visits: acc.visits,
      lastVisit: acc.lastVisit,
      daysSince,
      lastMaster: acc.lastMaster,
      spent: Math.round(acc.spent),
    })
  }

  result.sort((a, b) => b.spent - a.spent)
  return result
}

export const buildCsv = (rows: SleepingClient[]): string => {
  const header = 'Jméno;Telefon;Email;Návštěv;Poslední návštěva;Dní;Mistr;Utraceno Kč'
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`
  const lines = rows.map((r) =>
    [
      esc(r.name),
      r.phone,
      r.email,
      r.visits,
      r.lastVisit,
      r.daysSince,
      esc(r.lastMaster),
      r.spent,
    ].join(';'),
  )
  return [header, ...lines].join('\n')
}
