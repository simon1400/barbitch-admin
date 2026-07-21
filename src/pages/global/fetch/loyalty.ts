// Data-слой admin-таба «Лояльность» (bitchcard, К3).
//
// Чистый fetch с явным Bearer VITE_STRAPI_TOKEN (НЕ Axios из lib/api: его
// интерсептор разворачивает res.data.data и подменяет Authorization — гоча
// s99/s103). Лояльность = PII → Public-права в Strapi НЕ включаем.

import { getSession } from '../../../services/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

interface StrapiListResponse<T> {
  data: T[]
  meta?: { pagination?: { pageCount?: number; total?: number } }
}

const authHeaders = (): Record<string, string> =>
  strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {}

const getJson = async <T>(pathWithQuery: string): Promise<StrapiListResponse<T>> => {
  const res = await fetch(`${API_URL}${pathWithQuery}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Strapi GET ${pathWithQuery} → ${res.status}`)
  return res.json()
}

const sendJson = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strapi ${method} ${path} → ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.status === 204 ? null : res.json()
}

const fetchAllPages = async <T>(path: string, pageSize = 500): Promise<T[]> => {
  const sep = path.includes('?') ? '&' : '?'
  const page = (n: number) =>
    getJson<T>(
      `${path}${sep}pagination[page]=${n}&pagination[pageSize]=${pageSize}&pagination[withCount]=true`,
    )
  const first = await page(1)
  const out = [...(first.data || [])]
  const pageCount = first.meta?.pagination?.pageCount || 1
  if (pageCount > 1) {
    const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => page(i + 2)))
    for (const r of rest) out.push(...(r.data || []))
  }
  return out
}

// ── типы ──

export interface LoyaltyTx {
  id: number
  documentId: string
  delta: number
  reason: 'visit' | 'manual' | 'signup' | 'referral'
  cardYear: number
  comment: string | null
  createdByName: string | null
  createdAt: string
  client: { documentId: string; name: string; email: string | null; cabinetLastLoginAt: string | null } | null
}

export interface LoyaltyAccount {
  clientDocId: string
  name: string
  email: string | null
  cabinetLastLoginAt: string | null
  balanceKc: number
  stamps: number
  visits: number
  lastTxAt: string | null
  transactions: LoyaltyTx[]
}

export interface Reward {
  id: number
  documentId: string
  title: string
  thresholdKc: number
  discountType: 'percent' | 'fixed' | 'voucher'
  discountValue: number
  active: boolean
  order: number
}

export interface Redemption {
  id: number
  documentId: string
  cardYear: number
  status: 'available' | 'used' | 'expired'
  code: string | null
  usedInBookingDocId: string | null
  expiresAt: string | null
  createdAt: string
  client: { documentId: string; name: string } | null
  reward: { documentId: string; title: string; thresholdKc: number } | null
}

export interface ClientHit {
  documentId: string
  name: string
  email: string | null
  phone: string | null
}

// ── аккаунты (агрегат по транзакциям карточного года) ──

export async function fetchLoyaltyAccounts(cardYear: number): Promise<LoyaltyAccount[]> {
  const txs = await fetchAllPages<LoyaltyTx>(
    `/api/loyalty-transactions?filters[cardYear][$eq]=${cardYear}` +
      `&fields[0]=delta&fields[1]=reason&fields[2]=cardYear&fields[3]=comment&fields[4]=createdByName&fields[5]=createdAt` +
      `&populate[client][fields][0]=name&populate[client][fields][1]=email&populate[client][fields][2]=cabinetLastLoginAt` +
      `&sort=createdAt:desc`,
  )
  const byClient = new Map<string, LoyaltyAccount>()
  for (const tx of txs) {
    if (!tx.client) continue
    let acc = byClient.get(tx.client.documentId)
    if (!acc) {
      acc = {
        clientDocId: tx.client.documentId,
        name: tx.client.name,
        email: tx.client.email || null,
        cabinetLastLoginAt: tx.client.cabinetLastLoginAt || null,
        balanceKc: 0,
        stamps: 0,
        visits: 0,
        lastTxAt: null,
        transactions: [],
      }
      byClient.set(tx.client.documentId, acc)
    }
    acc.balanceKc += Number(tx.delta) || 0
    if (tx.reason === 'visit') acc.visits++
    if (!acc.lastTxAt || tx.createdAt > acc.lastTxAt) acc.lastTxAt = tx.createdAt
    acc.transactions.push(tx)
  }
  const accounts = [...byClient.values()]
  for (const acc of accounts) acc.stamps = Math.floor(acc.balanceKc / 1000)
  accounts.sort((a, b) => b.balanceKc - a.balanceKc)
  return accounts
}

// ── цифровые аккаунты кабинета (зарегистрировались / заходили) ──

export interface CabinetAccount {
  documentId: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  emailVerifiedAt: string | null
  cabinetLastLoginAt: string | null
  marketingConsent: boolean
}

// Клиенты с подтверждённым e-mail = завели цифровой аккаунт (карточка
// «С цифровым аккаунтом»). cabinetLastLoginAt != null → реально входили.
// Сортировка по дате регистрации (emailVerifiedAt всегда задан из-за фильтра;
// сорт по cabinetLastLoginAt дал бы NULLS FIRST в Postgres → «не входившие» вверху).
export async function fetchCabinetClients(): Promise<CabinetAccount[]> {
  return fetchAllPages<CabinetAccount>(
    `/api/clients?filters[emailVerifiedAt][$notNull]=true` +
      `&fields[0]=name&fields[1]=email&fields[2]=phone&fields[3]=source` +
      `&fields[4]=emailVerifiedAt&fields[5]=cabinetLastLoginAt&fields[6]=marketingConsent` +
      `&sort=emailVerifiedAt:desc`,
  )
}

// ── ручная корректировка ──

export async function searchLoyaltyClients(q: string, limit = 8): Promise<ClientHit[]> {
  const query = q.trim()
  if (!query) return []
  const digits = query.replace(/[\s()-]/g, '')
  const phoneQ = /^\+?\d{3,}$/.test(digits) ? digits : query
  const res = await getJson<ClientHit>(
    `/api/clients?filters[$or][0][name][$containsi]=${encodeURIComponent(query)}` +
      `&filters[$or][1][email][$containsi]=${encodeURIComponent(query)}` +
      `&filters[$or][2][phone][$containsi]=${encodeURIComponent(phoneQ)}` +
      `&fields[0]=name&fields[1]=email&fields[2]=phone&pagination[pageSize]=${limit}`,
  )
  return res.data || []
}

export async function createManualTransaction(input: {
  clientDocId: string
  delta: number
  cardYear: number
  comment: string
}): Promise<void> {
  await sendJson('POST', '/api/loyalty-transactions', {
    data: {
      client: input.clientDocId,
      delta: Math.round(input.delta),
      reason: 'manual',
      cardYear: input.cardYear,
      comment: input.comment || null,
      createdByName: getSession()?.username || 'admin',
    },
  })
}

// ── награды (CRUD) ──

export async function fetchRewards(): Promise<Reward[]> {
  const res = await getJson<Reward>('/api/rewards?sort=thresholdKc:asc&pagination[pageSize]=100')
  return res.data || []
}

export type RewardInput = Pick<
  Reward,
  'title' | 'thresholdKc' | 'discountType' | 'discountValue' | 'active' | 'order'
>

export async function createReward(input: RewardInput): Promise<void> {
  await sendJson('POST', '/api/rewards', { data: input })
}

export async function updateReward(documentId: string, input: Partial<RewardInput>): Promise<void> {
  await sendJson('PUT', `/api/rewards/${documentId}`, { data: input })
}

export async function deleteReward(documentId: string): Promise<void> {
  await sendJson('DELETE', `/api/rewards/${documentId}`)
}

// ── redemptions ──

export async function fetchRedemptions(status?: Redemption['status']): Promise<Redemption[]> {
  const filter = status ? `&filters[status][$eq]=${status}` : ''
  return fetchAllPages<Redemption>(
    `/api/redemptions?populate[client][fields][0]=name` +
      `&populate[reward][fields][0]=title&populate[reward][fields][1]=thresholdKc` +
      `&sort=createdAt:desc${filter}`,
  )
}

export async function markRedemptionUsed(documentId: string): Promise<void> {
  await sendJson('PUT', `/api/redemptions/${documentId}`, { data: { status: 'used' } })
}

// ── метрики программы (охват + стоимость скидок) ──

// Считает только `meta.pagination.total` (pageSize=1 — сами строки не тянем).
const countClients = async (filterQuery = ''): Promise<number> => {
  const res = await getJson<{ id: number }>(
    `/api/clients?fields[0]=id&pagination[pageSize]=1&pagination[withCount]=true${filterQuery}`,
  )
  return res.meta?.pagination?.total ?? 0
}

interface RedemptionMetricRow {
  status: Redemption['status']
  discountKc: number | null
  reward: { documentId: string; title: string; thresholdKc: number } | null
}

export interface RewardTierMetric {
  title: string
  thresholdKc: number
  available: number
  used: number
  expired: number
  discountUsedKc: number
}

export interface LoyaltyMetrics {
  cardYear: number
  clientTotal: number
  clientVerified: number
  clientLoggedIn: number
  redemptionsByStatus: { available: number; used: number; expired: number }
  discountUsedKc: number
  tiers: RewardTierMetric[]
}

export async function fetchLoyaltyMetrics(cardYear: number): Promise<LoyaltyMetrics> {
  const [clientTotal, clientVerified, clientLoggedIn, rows] = await Promise.all([
    countClients(),
    countClients('&filters[emailVerifiedAt][$notNull]=true'),
    countClients('&filters[cabinetLastLoginAt][$notNull]=true'),
    fetchAllPages<RedemptionMetricRow>(
      `/api/redemptions?filters[cardYear][$eq]=${cardYear}` +
        `&fields[0]=status&fields[1]=discountKc` +
        `&populate[reward][fields][0]=title&populate[reward][fields][1]=thresholdKc`,
    ),
  ])

  const redemptionsByStatus = { available: 0, used: 0, expired: 0 }
  let discountUsedKc = 0
  const tierMap = new Map<string, RewardTierMetric>()

  for (const r of rows) {
    redemptionsByStatus[r.status]++
    const applied = r.status === 'used' ? Number(r.discountKc) || 0 : 0
    discountUsedKc += applied

    const key = r.reward?.documentId || `t${r.reward?.thresholdKc ?? 0}`
    let tier = tierMap.get(key)
    if (!tier) {
      tier = {
        title: r.reward?.title || '—',
        thresholdKc: r.reward?.thresholdKc ?? 0,
        available: 0,
        used: 0,
        expired: 0,
        discountUsedKc: 0,
      }
      tierMap.set(key, tier)
    }
    tier[r.status]++
    tier.discountUsedKc += applied
  }

  const tiers = [...tierMap.values()].sort((a, b) => a.thresholdKc - b.thresholdKc)
  return {
    cardYear,
    clientTotal,
    clientVerified,
    clientLoggedIn,
    redemptionsByStatus,
    discountUsedKc,
    tiers,
  }
}
