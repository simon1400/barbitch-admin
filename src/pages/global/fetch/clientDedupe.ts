// Data-слой модуля «Дубли клиентов» (/global/client-duplicates, owner + administrator).
//
// Ручки /api/client-dedupe/* защищены admin-jwt → запрос идёт мимо Axios-инстанса
// (он подменяет Authorization на токен сессии и разворачивает res.data.data —
// для этих ответов не годится, гоча s99/s103). Общий клиент — lib/apiFetch.ts.

import { makeApiFetch } from '../../../lib/apiFetch'

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Доступ только для владельца — войдите заново.',
  primary_required: 'Не выбрана главная карточка.',
  nothing_to_merge: 'Не выбраны карточки для слияния.',
  nothing_selected: 'Ничего не выбрано.',
  client_not_found: 'Карточка клиента не найдена (возможно, уже слита).',
  name_required: 'Имя не может быть пустым.',
  bad_email: 'Некорректный e-mail.',
  bad_phone: 'Некорректный телефон — нужно минимум 9 цифр.',
}

const api = makeApiFetch('/api/client-dedupe', CODE_MESSAGES, (status) => `Ошибка ${status}`)

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

type MatchReason = 'name' | 'email' | 'phone'

export interface DupGroup {
  key: string
  tier: 'strong' | 'weak'
  matchedOn: MatchReason[]
  blacklistConflict: boolean
  futureActive: number
  totalBookings: number
  clients: DupClient[]
}

interface DedupeStats {
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

/** чужая карточка с тем же телефоном/e-mail — сервер отдаёт её после правки контактов */
export interface ContactConflict {
  documentId: string
  name: string
  phone: string | null
  email: string | null
}

export interface ClientUpdateResult {
  ok: boolean
  renamedBookings: number
  /** телефон в том виде, в каком лёг в базу (сервер приводит к +420…) */
  phone: string | null
  /** карточки с тем же контактом — правку не блокируют, лечатся в «Дублях клиентов» */
  duplicates: ContactConflict[]
}

/** правка контактов; renameBookings=true переписывает имя во ВСЕХ бронях (грид календаря) */
export const updateClientContacts = (docId: string, patch: ClientPatch, renameBookings = true) =>
  api<ClientUpdateResult>('POST', '/client', { docId, patch, renameBookings })

export const setGroupBlacklist = (docIds: string[], blacklisted: boolean, reason?: string) =>
  api<{ ok: boolean; affected: number }>('POST', '/blacklist', { docIds, blacklisted, reason })

export const ignoreGroup = (docIds: string[], note?: string) =>
  api<{ ok: boolean; key: string }>('POST', '/ignore', { docIds, note })

export const unignoreGroup = (groupKey: string) =>
  api<{ ok: boolean; key: string }>('POST', '/unignore', { groupKey })

export const fetchMergeHistory = (limit = 50) =>
  api<MergeLogEntry[]>('GET', `/history?limit=${limit}`)
