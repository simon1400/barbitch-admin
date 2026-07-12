// Кастомные лейблы броней (Strapi коллекция booking-label) — справочник для
// календаря («Spravovat štítky», как stavy в Noona). На саму бронь лейбл пишется
// СНАПШОТОМ {name, color} через движок (enginePatchBooking {label}) — удаление
// лейбла из справочника уже проставленные брони не трогает.
// GET с явным Bearer (Public-прав у коллекции нет); мутации через admin-Axios
// (интерсептор сам подставляет токен на POST/PUT/DELETE).

import { Axios } from '../../../lib/api'

const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const authHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined

export interface BookingLabel {
  documentId: string
  name: string
  color: string
  order: number
}

// Палитра как в Noona: зелёный/красный/оранжевый/синий/фиолетовый/чёрный/серый
export const LABEL_COLORS = [
  '#22c55e',
  '#ef4444',
  '#f59e0b',
  '#3b82f6',
  '#8b5cf6',
  '#161615',
  '#9ca3af',
] as const

export async function fetchBookingLabels(): Promise<BookingLabel[]> {
  const res = (await Axios.get(`/api/booking-labels?sort=order:asc&pagination[pageSize]=100`, {
    headers: authHeaders,
  })) as BookingLabel[]
  return res || []
}

export const createBookingLabel = (name: string, color: string, order: number) =>
  Axios.post(`/api/booking-labels`, { data: { name, color, order } })

export const updateBookingLabel = (documentId: string, data: Partial<Pick<BookingLabel, 'name' | 'color' | 'order'>>) =>
  Axios.put(`/api/booking-labels/${documentId}`, { data })

export const deleteBookingLabel = (documentId: string) => Axios.delete(`/api/booking-labels/${documentId}`)
