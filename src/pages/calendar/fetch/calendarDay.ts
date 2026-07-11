// Фаза 2 (каркас, s99): день из ЗЕРКАЛА Noona (коллекции booking/personal в Strapi).
// Read-only. GET идёт с явным Bearer (Axios-интерсептор добавляет токен только на
// мутации, а Public-права на booking не включаем — там PII клиентов).

import { Axios } from '../../../lib/api'

const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const authHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined

export interface CalendarService {
  title: string
  price: number | null
  durationMin: number | null
}

export interface CalendarBooking {
  id: number
  documentId: string
  clientNameRaw: string
  employeeNameRaw: string
  noonaEmployeeId: string
  date: string
  startsAt: string | null
  endsAt: string | null
  status: 'active' | 'checkedOut' | 'cancelled' | 'noshow'
  services: CalendarService[] | null
  totalPrice: number | null
  comment: string | null
  customerComment: string | null
  bsChannel: string | null
}

export interface CalendarPersonal {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  position: 'administrator' | 'master'
  isActive: boolean
}

export interface CalendarDay {
  bookings: CalendarBooking[]
  personals: CalendarPersonal[]
}

export async function fetchCalendarDay(dateStr: string): Promise<CalendarDay> {
  const [bookings, personals] = await Promise.all([
    Axios.get(
      `/api/bookings?filters[date][$eq]=${dateStr}&sort=startsAt:asc&pagination[pageSize]=200`,
      { headers: authHeaders },
    ) as Promise<CalendarBooking[]>,
    Axios.get(
      `/api/personals?fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=position&fields[3]=isActive&pagination[pageSize]=100`,
    ) as Promise<CalendarPersonal[]>,
  ])
  return { bookings: bookings || [], personals: personals || [] }
}

// Группировка дня по мастерам: активные мастера всегда показаны (даже без броней),
// брони бывших сотрудников группируются по employeeNameRaw
export interface MasterColumn {
  key: string
  name: string
  isActiveMaster: boolean
  bookings: CalendarBooking[]
}

export function groupByMaster(day: CalendarDay): MasterColumn[] {
  const columns = new Map<string, MasterColumn>()

  for (const p of day.personals) {
    if (p.position !== 'master' || !p.isActive || !p.noonaEmployeeId) continue
    columns.set(p.noonaEmployeeId, {
      key: p.noonaEmployeeId,
      name: p.name,
      isActiveMaster: true,
      bookings: [],
    })
  }

  for (const b of day.bookings) {
    const key = b.noonaEmployeeId || b.employeeNameRaw || '—'
    let col = columns.get(key)
    if (!col) {
      col = {
        key,
        name: b.employeeNameRaw || 'Неизвестный мастер',
        isActiveMaster: false,
        bookings: [],
      }
      columns.set(key, col)
    }
    col.bookings.push(b)
  }

  return [...columns.values()].sort(
    (a, b) => Number(b.isActiveMaster) - Number(a.isActiveMaster) || a.name.localeCompare(b.name, 'cs'),
  )
}
