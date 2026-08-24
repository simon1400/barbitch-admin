// Data-слой модуля «Дубли клиентов» (/global/client-duplicates, owner + administrator).
//
// Ручки /api/client-dedupe/* защищены admin-jwt → ЧИСТЫЙ fetch с Bearer userJwt
// (Axios-интерсептор admin-апки подменяет Authorization на токен сессии
// и разворачивает res.data.data — для этих ответов не годится, гоча s99/s103).

import { getToken } from '../../../services/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export class DedupeApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Доступ только для владельца — войдите заново.',
  primary_required: 'Не выбрана главная карточка.',
  nothing_to_merge: 'Не выбраны карточки для слияния.',
  nothing_selected: 'Ничего не выбрано.',
  client_not_found: 'Карточка клиента не найдена (возможно, уже слита).',
  name_required: 'Имя не может быть пустым.',
  bad_email: 'Некорректный e-mail.',
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/client-dedupe${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const code = json?.error?.code || 'internal'
    throw new DedupeApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Ошибка ${res.status}`)
  }
  return json as T
}

export interface DupClient {
  id: number
  documentId: string
  name: string
  email: string | null
  phone: string | null
  blacklisted: boolean
  blacklistReason: string | null
  noonaCustomerId: string | null
  source: string | null
  notes: string | null
  birthday: string | null
  emailVerifiedAt: string | null
  cabinetLastLoginAt: string | null
  marketingConsent: boolean
  reminderOptOut: boolean
  createdAt: string | null
  bookings: number
  lastVisit: string | null
  futureActive: number
  loyaltyTx: number
  redemptions: number
}

export type MatchReason = 'name' | 'email' | 'phone'

export interface DupGroup {
  key: string
  tier: 'strong' | 'weak'
  matchedOn: MatchReason[]
  blacklistConflict: boolean
  futureActive: number
  totalBookings: number
  clients: DupClient[]
}

export interface DedupeStats {
  clientsTotal: number
  strongGroups: number
  weakGroups: number
  extraRecords: number
  blacklistConflicts: number
  withFutureBookings: number
  ignoredGroups: number
}

export interface DedupeGroupsResponse {
  strong: DupGroup[]
  weak: DupGroup[]
  ignored: DupGroup[]
  stats: DedupeStats
}

export interface MergeResult {
  ok: boolean
  primaryDocId: string
  merged: number
  moved: Record<string, number>
}

export interface MergeLogEntry {
  documentId: string
  action: 'merge' | 'ignore' | 'unignore' | 'blacklist'
  groupKey: string | null
  primaryDocId: string | null
  primaryName: string | null
  mergedDocIds: string[] | null
  details: Record<string, unknown> | null
  actorName: string | null
  createdAt: string
}

export const fetchDuplicateGroups = () => api<DedupeGroupsResponse>('GET', '/groups')

export const mergeClients = (primaryDocId: string, docIds: string[], renameBookings = true) =>
  api<MergeResult>('POST', '/merge', { primaryDocId, docIds, renameBookings })

export interface ClientPatch {
  name?: string
  phone?: string | null
  email?: string | null
  notes?: string | null
  blacklisted?: boolean
  blacklistReason?: string | null
}

/** правка контактов; renameBookings=true переписывает имя во ВСЕХ бронях (грид календаря) */
export const updateClientContacts = (docId: string, patch: ClientPatch, renameBookings = true) =>
  api<{ ok: boolean; renamedBookings: number }>('POST', '/client', { docId, patch, renameBookings })

export const setGroupBlacklist = (docIds: string[], blacklisted: boolean, reason?: string) =>
  api<{ ok: boolean; affected: number }>('POST', '/blacklist', { docIds, blacklisted, reason })

export const ignoreGroup = (docIds: string[], note?: string) =>
  api<{ ok: boolean; key: string }>('POST', '/ignore', { docIds, note })

export const unignoreGroup = (groupKey: string) =>
  api<{ ok: boolean; key: string }>('POST', '/unignore', { groupKey })

export const fetchMergeHistory = (limit = 50) =>
  api<MergeLogEntry[]>('GET', `/history?limit=${limit}`)
