// «Источники броней» (s200): GET /api/engine/admin/attribution/report — только владелец.
// Ответ — не обёртка Strapi, поэтому makeApiFetch, а не Axios-интерсептор.
import { makeApiFetch } from '../../../../lib/apiFetch'
import type { BookingStatus } from '../../../../lib/bookingStatus'

export type AttributionBasis = 'created' | 'visit'
export type AttributionTouch = 'first' | 'last'

export interface AttributionChannel {
  key: string
  label: string
  bookings: number
  newClients: number
  checkedOut: number
  active: number
  cancelled: number
  noshow: number
  revenue: number
  /** все состоявшиеся визиты новых клиентов этого канала — за всё время, любой канал записи */
  newClientsLifetimeRevenue: number
  newClientsLifetimeVisits: number
}

export interface AttributionCampaign {
  channel: string
  channelLabel: string
  campaign: string
  bookings: number
  newClients: number
  checkedOut: number
  cancelled: number
  revenue: number
}

export interface AttributionRow {
  id: number
  documentId: string
  /** 'YYYY-MM-DD HH:MM' по Праге */
  created: string
  date: string
  time: string | null
  status: BookingStatus
  origin: string
  createdBy: string | null
  master: string
  clientId: number | null
  clientName: string
  price: number
  isNewClient: boolean
  /** flag — посчитан в момент брони; computed — досчитан отчётом для старых броней */
  newClientSource: 'flag' | 'computed'
  rebook: boolean
  channel: string
  channelLabel: string
  campaign: string
  firstTouch: string
  lastTouch: string
  landing: string
  hasAttribution: boolean
}

export interface AttributionReport {
  from: string
  to: string
  basis: AttributionBasis
  touch: AttributionTouch
  totals: {
    bookings: number
    newClients: number
    site: number
    siteWithSource: number
    admin: number
    revenue: number
  }
  channels: AttributionChannel[]
  campaigns: AttributionCampaign[]
  rows: AttributionRow[]
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Отчёт доступен только владельцу — войдите заново.',
  range_too_long: 'Слишком длинный период — не больше 400 дней.',
  bad_range: 'Проверьте даты периода.',
}

const attributionFetch = makeApiFetch('/api', CODE_MESSAGES, (status) => `Ошибка ${status}`)

export const fetchAttributionReport = (p: { from: string; to: string; basis: AttributionBasis; touch: AttributionTouch }) =>
  attributionFetch<AttributionReport>(
    'GET',
    `/engine/admin/attribution/report?from=${p.from}&to=${p.to}&basis=${p.basis}&touch=${p.touch}`,
  )
