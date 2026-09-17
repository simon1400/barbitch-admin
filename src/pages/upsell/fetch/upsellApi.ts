// Клиент ручек модуля «Дозаписи администраторов» (s197): /api/engine/admin/upsell/*.
// Ответ — не обёртка Strapi, поэтому общий makeApiFetch (как у движка календаря),
// а не Axios-интерсептор.
import { makeApiFetch } from '../../../lib/apiFetch'

export type UpsellMode = 'after' | 'before'

export interface UpsellService {
  serviceDocId: string
  title: string
  bucket: string
  durationMin: number
  /** цена по тиру мастера (junior уже −20 %) — от неё считаются и скидка, и комиссия */
  price: number
  discountedPrice: number
  commissionKc: number
  startMin: number
  startTime: string
  endTime: string
}

export interface UpsellOffer {
  mode: UpsellMode
  employeeDocId: string
  employeeName: string
  tier: 'senior' | 'junior'
  anchorBookingDocId: string
  startMin: number
  services: UpsellService[]
}

/**
 * Результат предложения по клиенту за день (s199).
 *   booked — дозапись администратора (из брони), site — дозаписалась сама на сайте;
 *   declined / not_offered — отметка администратора с причиной.
 */
export type UpsellOutcome = 'booked' | 'site' | 'declined' | 'not_offered'
export type UpsellManualOutcome = 'declined' | 'not_offered'

export interface UpsellResult {
  outcome: UpsellOutcome
  reason: string | null
  comment: string
  adminUsername: string
  updatedAt: string | null
  bookingDocId: string | null
}

export interface UpsellClient {
  clientDocId: string
  clientName: string
  phone: string
  inSalon: boolean
  /** сегодня хотя бы один визит уже начался — результат обязателен */
  arrived: boolean
  /** визиты дня закончились или закрыты */
  left: boolean
  result: UpsellResult | null
  needsResult: boolean
  alreadyRebooked: boolean
  firstStartMin: number
  bookings: {
    documentId: string
    status: string
    employeeName: string
    time: string
    services: string[]
    isRebook: boolean
  }[]
  offers: UpsellOffer[]
}

export interface UpsellDay {
  date: string
  now: string | null
  discountPercent: number
  commissionPercent: number
  past?: boolean
  clients: UpsellClient[]
  /** сегодня: уже ушедшие клиенты — остаются в списке ради отметки результата */
  leftClients: UpsellClient[]
}

export interface UpsellResultBody {
  client: string
  outcome: UpsellManualOutcome
  reason: string
  comment: string
}

/** Отчёт владельца «Контроль предложений» за месяц. */
export type UpsellReportOutcome = UpsellOutcome | 'missing'

export interface UpsellReport {
  month: string
  today: string
  totals: {
    visited: number
    site: number
    required: number
    marked: number
    booked: number
    declined: number
    notOffered: number
    missing: number
    conversionPct: number | null
    coveragePct: number | null
  }
  byAdmin: { adminUsername: string; booked: number; declined: number; notOffered: number }[]
  reasons: { outcome: UpsellManualOutcome; reason: string; count: number }[]
  days: { date: string; duty: string; visited: number; site: number; booked: number; declined: number; notOffered: number; missing: number }[]
  rows: {
    date: string
    time: string
    clientDocId: string
    clientName: string
    employees: string[]
    services: string[]
    outcome: UpsellReportOutcome
    reason: string | null
    comment: string
    adminUsername: string
    updatedAt: string | null
    duty: string
  }[]
}

export interface UpsellCreateBody {
  anchorBooking: string
  service: string
  employee: string
  mode: UpsellMode
}

export interface UpsellCreated {
  bookingId: string
  date: string
  mode: UpsellMode
  time: string
  endTime: string
  totalPrice: number
  originalPrice: number
  employee: { documentId: string; name: string }
  serviceTitle: string
  clientName: string
  commission: { kc: number; addMoneyDocId: string } | null
  commissionReason: 'no_personal' | null
}

export type UpsellState = 'awaiting_visit' | 'awaiting_confirmation' | 'confirmed' | 'cancelled' | 'no_commission'

export interface UpsellMineRow {
  bookingDocId: string
  date: string
  time: string
  clientName: string
  serviceTitle: string
  employeeName: string
  adminUsername: string
  originalPrice: number
  totalPrice: number | null
  bookingStatus: string
  state: UpsellState
  commissionKc: number
}

export interface UpsellMine {
  month: string
  rows: UpsellMineRow[]
  expectedKc: number
  confirmedKc: number
  byAdmin?: { adminUsername: string; count: number; expectedKc: number; confirmedKc: number }[]
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Сессия истекла — войдите заново.',
  slot_taken: 'Окно уже заняли — обновите список.',
  upsell_stale: 'У клиента что-то изменилось — обновите список.',
  already_rebooked: 'У клиента уже есть дозапись сегодня.',
  rebook_unavailable: 'Эту услугу нельзя дозаписать.',
  employee_service_mismatch: 'Мастер не делает эту услугу.',
  commission_failed: 'Не удалось создать комиссию — дозапись не создана.',
  booking_not_found: 'Бронь клиента не найдена — обновите список.',
  bad_date: 'Неверная дата.',
  bad_month: 'Неверный месяц.',
  result_not_arrived: 'Клиент ещё не пришёл — отметить результат можно после начала визита.',
  result_auto: 'У клиента уже есть дозапись — результат отмечен сам. Обновите список.',
  comment_required: 'Для «Другое» напишите, что случилось.',
  bad_reason: 'Выберите причину.',
  bad_outcome: 'Выберите результат.',
  owner_only: 'Отчёт доступен только владельцу.',
}

const upsellFetch = makeApiFetch('/api', CODE_MESSAGES, (status) => `Ошибка ${status}`)

export const fetchUpsellDay = (date: string) =>
  upsellFetch<UpsellDay>('GET', `/engine/admin/upsell/day?date=${encodeURIComponent(date)}`)

export const createUpsell = (body: UpsellCreateBody) =>
  upsellFetch<UpsellCreated>('POST', '/engine/admin/upsell', body)

export const saveUpsellResult = (body: UpsellResultBody) =>
  upsellFetch<{ clientDocId: string; result: UpsellResult }>('POST', '/engine/admin/upsell/result', body)

export const fetchUpsellReport = (month: string) =>
  upsellFetch<UpsellReport>('GET', `/engine/admin/upsell/report?month=${encodeURIComponent(month)}`)

export const fetchUpsellMine = (month: string) =>
  upsellFetch<UpsellMine>('GET', `/engine/admin/upsell/mine?month=${encodeURIComponent(month)}`)
