// Клиент админских ручек движка бронирования (/api/engine/admin/*) + каталог
// salon-service + поиск клиентов. Мутации движка идут ЧИСТЫМ fetch с admin-jwt
// (userJwt из localStorage): Axios-интерсептор admin-апки принудительно подменяет
// Authorization на VITE_STRAPI_TOKEN для POST/PATCH/DELETE и разворачивает
// res.data.data — для engine-ответов не годится.

import { Axios } from '../../../lib/api'
import { getToken } from '../../../services/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const strapiHeaders = strapiToken ? { Authorization: `Bearer ${strapiToken}` } : undefined

// ── ошибки движка ──

export class EngineApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Человеческие сообщения по кодам движка
const CODE_MESSAGES: Record<string, string> = {
  slot_taken: 'Termín je již obsazený (mistr má v tuto dobu rezervaci nebo blok).',
  blacklisted: 'Klient je na blacklistu.',
  mirror_block: 'Blok pochází z Noona — spravuje ho synchronizace, smazat lze jen vlastní bloky.',
  mirror_booking: 'Rezervace pochází z Noona — spravuje ji synchronizace, smazat ji lze jen v Noona.',
  unauthorized: 'Přihlášení vypršelo — přihlaste se znovu.',
  employee_service_mismatch: 'Mistr tuto službu nedělá.',
}

async function engineFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const code = json?.error?.code || 'internal'
    throw new EngineApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Chyba ${res.status}`)
  }
  return json as T
}

// ── мутации броней ──

export interface EngineServiceItem {
  service: string // salon-service documentId
  variant?: string | null
  modifiers?: string[]
  priceOverride?: number | null
}

export interface EngineCreateBookingInput {
  employee: string // personal documentId
  date: string
  time: string
  services: EngineServiceItem[]
  clientDocId?: string
  client?: { name: string; phone: string; email?: string }
  priceOverride?: number | null
  comment?: string
  // чекбокс «отправить potvrzení» — письмо клиенту (только e-mail, без Telegram салону)
  notify?: boolean
}

export const engineCreateBooking = (input: EngineCreateBookingInput) =>
  engineFetch<{ bookingId: string }>('POST', '/engine/admin/bookings', input)

export interface EnginePatchInput {
  date?: string
  time?: string
  employee?: string // personal documentId
  status?: 'active' | 'checkedOut' | 'cancelled' | 'noshow'
  // «клиент dorazil» — промежуточный шаг перед checkedOut (Proběhla)
  arrived?: boolean
  comment?: string
  totalPrice?: number
  // смена услуги: новый снапшот services + пересчёт цены/длительности на сервере
  serviceItems?: EngineServiceItem[]
  // чекбокс «уведомить клиента» — письмо об отмене (сервер учитывает только при status=cancelled)
  notify?: boolean
  // чекбокс «уведомить клиента» при переносе — письмо с новыми деталями (только при date/time/employee)
  notifyClient?: boolean
  // кастомный лейбл (снапшот из справочника booking-label); null → снять
  label?: { name: string; color: string } | null
}

// Ответ = обновлённый документ брони (движок возвращает findOne после патча)
export interface EnginePatchResult {
  status: string
  arrived?: boolean
  services?: { title: string; price: number | null; durationMin: number | null }[] | null
  totalPrice?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

export const enginePatchBooking = (bookingDocId: string, patch: EnginePatchInput) =>
  engineFetch<EnginePatchResult>('PATCH', `/engine/admin/bookings/${bookingDocId}`, patch)

// Полное удаление брони (корзина в drawer) — ЖЁСТКИЙ delete, не отмена
export const engineDeleteBooking = (bookingDocId: string) =>
  engineFetch<{ deleted: number }>('DELETE', `/engine/admin/bookings/${bookingDocId}`)

// ── блоки времени ──

// Повтор блока: daily = каждый день до `until`; weekly = выбранные дни недели каждую
// неделю до `until` (weekday 0=Ne..6=So, как getUTCDay). Без recurrence — один блок.
export interface BlockRecurrence {
  freq: 'daily' | 'weekly'
  until: string // YYYY-MM-DD включительно
  weekdays?: number[]
}

export const engineCreateBlock = (input: {
  employee: string
  date: string
  startMin: number
  endMin: number
  title?: string
  recurrence?: BlockRecurrence
}) => engineFetch<{ documentId: string; count: number }>('POST', '/engine/admin/blocks', input)

// series=true → удалить все повторения серии (общий ключ группы)
export const engineDeleteBlock = (blockDocId: string, series = false) =>
  engineFetch<{ deleted: number }>('DELETE', `/engine/admin/blocks/${blockDocId}${series ? '?series=1' : ''}`)

// Правка одного конкретного блока: время в рамках его дня и/или название
export const enginePatchBlock = (blockDocId: string, patch: { startMin?: number; endMin?: number; title?: string }) =>
  engineFetch<{ documentId: string }>('PATCH', `/engine/admin/blocks/${blockDocId}`, patch)

// Сколько блоков в серии (own-серия делит noonaKey, зеркальная rrule — noonaBlockedId)
export async function fetchBlockSeriesCount(block: {
  own?: boolean
  noonaKey?: string | null
  noonaBlockedId?: string | null
}): Promise<number> {
  const filter = block.own
    ? block.noonaKey && `filters[noonaKey][$eq]=${encodeURIComponent(block.noonaKey)}`
    : block.noonaBlockedId && `filters[noonaBlockedId][$eq]=${encodeURIComponent(block.noonaBlockedId)}`
  if (!filter) return 1
  try {
    const res = (await Axios.get(`/api/time-blocks?${filter}&fields[0]=date&pagination[pageSize]=500`, {
      headers: strapiHeaders,
    })) as unknown[]
    return Math.max(1, (res || []).length)
  } catch {
    return 1
  }
}

// ── каталог salon-service (чтение через Bearer strapi-token, кэш 5 мин) ──

export interface CatalogVariant {
  label: string
  priceDiff: number
  durationDiff: number
  description?: string | null
}
export interface CatalogModifier {
  key: string
  label: string
  priceDiff: number
  durationDiff: number
  group?: string | null
  description?: string | null
}
export interface CatalogService {
  documentId: string
  title: string
  category: string
  categoryOrder: number
  order: number
  price: number
  durationMin: number
  variants: CatalogVariant[]
  modifiers: CatalogModifier[]
}

let catalogCache: { ts: number; data: CatalogService[] } | null = null

export async function fetchCatalog(force = false): Promise<CatalogService[]> {
  if (!force && catalogCache && Date.now() - catalogCache.ts < 5 * 60000) return catalogCache.data
  const res = (await Axios.get(
    `/api/salon-services?filters[active][$eq]=true&populate[variants]=true&populate[modifiers]=true&sort[0]=categoryOrder:asc&sort[1]=order:asc&pagination[pageSize]=200`,
    { headers: strapiHeaders },
  )) as CatalogService[]
  catalogCache = { ts: Date.now(), data: res || [] }
  return catalogCache.data
}

// Цена/длительность комбинации (зеркало slots-core.computePricing; сервер пересчитает сам)
export const JUNIOR_DISCOUNT_PERCENT = 20
export function calcCombo(
  svc: CatalogService,
  variantLabel: string | null,
  modifierKeys: string[],
  tier: 'senior' | 'junior',
): { price: number; seniorPrice: number; durationMin: number } {
  const variant = variantLabel ? svc.variants.find((v) => v.label === variantLabel) : null
  const mods = svc.modifiers.filter((m) => modifierKeys.includes(m.key))
  const seniorPrice =
    svc.price + (variant?.priceDiff || 0) + mods.reduce((s, m) => s + (m.priceDiff || 0), 0)
  const durationMin =
    svc.durationMin + (variant?.durationDiff || 0) + mods.reduce((s, m) => s + (m.durationDiff || 0), 0)
  const price = tier === 'junior' ? Math.round(seniorPrice * (1 - JUNIOR_DISCOUNT_PERCENT / 100)) : seniorPrice
  return { price, seniorPrice, durationMin }
}

// ── поиск клиентов (автокомплит модала «+ Rezervace») ──

export interface ClientHit {
  documentId: string
  name: string
  phone: string | null
  email: string | null
  blacklisted: boolean
}

export async function searchClients(q: string): Promise<ClientHit[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const enc = encodeURIComponent(query)
  const res = (await Axios.get(
    `/api/clients?filters[$or][0][name][$containsi]=${enc}&filters[$or][1][phone][$containsi]=${enc}&fields[0]=name&fields[1]=phone&fields[2]=email&fields[3]=blacklisted&pagination[pageSize]=8&sort=name:asc`,
    { headers: strapiHeaders },
  )) as ClientHit[]
  return res || []
}
