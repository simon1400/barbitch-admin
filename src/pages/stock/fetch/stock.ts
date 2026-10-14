// «Sklad — zásoby» (s251, Фаза 1 плана STOCK_NEXT_SESSION_PROMPT.md).
//
// 🟥 Данные — ТОЛЬКО ручки движка `/engine/admin/stock…`: у коллекций нет REST.
// Статус позиции, «сколько заказать», тексты количеств («2 bal. + 5 ks») и текст заказа
// считает сервер (services/stock.ts) — здесь своих копий этих правил нет.
// Цены (`lastPrice`, суммы заказа) сервер отдаёт только руководству — у администратора
// этих полей в ответе нет вовсе.
//
// Фаза 2 (s252): заказы (`/engine/admin/stock/orders…`) — черновик → «objednáno» → «přijato»;
// приход администратора создаёт ЗАПРОС на затрату (одобряют управляющая → владелец), руководства —
// затрату сразу. Администратору цены строк, суммы заказа и прихода сервер не отдаёт.
import { ApiError, makeApiFetch } from '../../../lib/apiFetch'
import { API_URL } from '../../../lib/config'
import { getToken } from '../../../services/auth'

export type StockStatus = 'ok' | 'low' | 'out'
export type StockUnit = 'ks' | 'ml' | 'g'
export type MoveKind = 'create' | 'count' | 'in' | 'out' | 'adjust'

export interface Labeled {
  key: string
  label: string
}

export interface StockItem {
  documentId: string
  name: string
  category: string
  location: string
  /** код места для QR-ярлыка полки (`/stock/l/:slug`) */
  locationSlug: string
  unit: StockUnit
  packSize: number
  /** остаток в базовой единице (`unit`) */
  qty: number
  /** минимум и «докупать до» — в упаковках */
  min: number
  target: number
  supplier: string
  url: string
  countEveryDays: number
  lastCountedAt: string | null
  lastCountedBy: string | null
  note: string
  active: boolean
  updatedAt: string | null
  status: StockStatus
  qtyText: string
  minText: string
  effectiveTarget: number
  /** сколько упаковок заказать (0 — в порядке) */
  suggestedPacks: number
  daysSinceCount: number | null
  countDue: boolean
  /** s252: упаковок по открытым заказам (ещё не пришли) */
  onOrderPacks: number
  /** s252: сколько ещё заказать с учётом заказанного */
  toOrderPacks: number
  /** s252: в «Rychlá inventura» этой недели (с понедельника не пересчитана, срок на этой неделе) */
  inventoryDue: boolean
  notifiedStatus?: 'low' | 'out' | null
  /** только руководству */
  lastPrice?: number | null
}

export interface StockMeta {
  today: string
  role: string
  /** руководство: заказы, цены, затраты */
  canEdit: boolean
  /** s257: позиции заводят и правят все три роли (цену — только руководство) */
  canEditItems?: boolean
  showPrices: boolean
  categories: (Labeled & { later?: boolean })[]
  units: Labeled[]
  statuses: Labeled[]
  moveKinds: Labeled[]
}

export interface StockMove {
  documentId: string
  itemDocId: string
  itemName: string
  kind: MoveKind
  mode: string | null
  qtyBefore: number
  qtyAfter: number
  delta: number
  beforeText: string
  afterText: string
  deltaText: string
  by: string
  role: string
  note: string
  at: string | null
}

export interface OrderLine {
  documentId: string
  name: string
  location: string
  status: StockStatus
  qtyText: string
  packSize: number
  unit: StockUnit
  packs: number
  /** s252: уже заказано и ещё не пришло */
  onOrderPacks: number
  url: string
  /** только руководству */
  price?: number | null
  sum?: number | null
}

/** s252: ниже минимума, но всё нужное уже заказано. */
export interface CoveredItem {
  documentId: string
  name: string
  location: string
  status: StockStatus
  qtyText: string
  onOrderPacks: number
  packSize: number
  unit: StockUnit
}

export interface OrderGroup {
  supplier: string
  lines: OrderLine[]
  text: string
  sum?: number | null
  sumPartial?: boolean
}

export interface StockAttentionItem {
  documentId: string
  name: string
  location: string
  qtyText: string
  minText: string
  /** s252: уже заказано — заказывать не нужно, ждём */
  onOrder?: boolean
}

export interface StockAttention {
  total: number
  out: StockAttentionItem[]
  low: StockAttentionItem[]
  countDue: number
  /** s252: «Rychlá inventura» этой недели */
  inventory?: { monday: string; isMonday: boolean; remaining: number }
  /** s252: заказы; null — не удалось загрузить */
  orders?: {
    waiting: number
    overdue: { documentId: string; supplier: string; days: number }[]
    /** только руководству */
    drafts?: number
    needsCost?: number
  } | null
}

export interface StockSuggest {
  names: string[]
  locations: string[]
  suppliers: string[]
}

/** Поля позиции для создания/правки (минимум/target — в упаковках). */
export interface StockItemInput {
  name?: string
  category?: string
  location?: string
  unit?: StockUnit
  packSize?: number | string
  min?: number | string
  target?: number | string
  supplier?: string
  url?: string
  lastPrice?: number | string | null
  countEveryDays?: number | string
  note?: string
  active?: boolean
  /** стартовый остаток (только создание) */
  packs?: number | string
  units?: number | string
}

export interface MoveInput {
  kind: 'count' | 'in' | 'out'
  packs?: number | string
  units?: number | string
  mode?: 'empty' | 'low'
  note?: string
}

export type OrderStatus = 'draft' | 'sent' | 'received' | 'cancelled'
export type OrderPayment = 'card' | 'cash' | 'transfer' | 'owner'
export type CostStatus = 'recorded' | 'pending' | 'approved' | 'rejected' | 'none' | 'failed'

export interface StockOrderLine {
  itemDocId: string
  name: string
  packSize: number
  unit: StockUnit
  packs: number
  receivedPacks: number
  remainingPacks: number
  /** только руководству */
  price?: number | null
  sum?: number | null
}

export interface StockReceipt {
  index: number
  at: string | null
  by: string
  role: string
  note: string
  complete: boolean
  lines: { itemDocId: string; name: string; packs: number }[]
  cost: { mode: 'cost' | 'request' | 'none'; status: CostStatus; costDocId?: string | null; requestDocId?: string | null }
  /** нет затраты (не ввели сумму / отклонили / не записалась) */
  needsCost: boolean
  /** только руководству */
  sum?: number | null
}

export interface StockOrder {
  documentId: string
  status: OrderStatus
  statusLabel: string
  supplier: string
  note: string
  expectedDays: number
  payment: OrderPayment | null
  lines: StockOrderLine[]
  /** текст для копирования поставщику (без цен) */
  text: string
  createdAt: string | null
  createdBy: string
  sentAt: string | null
  sentBy: string
  receivedAt: string | null
  closedBy: string
  daysSinceSent: number | null
  overdue: boolean
  remainingPacks: number
  receipts: StockReceipt[]
  needsCost: boolean
  costPending: boolean
  /** только руководству */
  sum?: number | null
  sumPartial?: boolean
}

export interface OrdersMeta {
  today: string
  role: string
  canEdit: boolean
  showPrices: boolean
  payments: OrderPayment[]
  vats: number[]
}

export interface OrderInput {
  supplier?: string
  note?: string
  expectedDays?: number | string
  payment?: OrderPayment | '' | null
  lines?: { itemDocId: string; packs: number | string; price?: number | string | null }[]
  /** только создание: сразу «objednáno» */
  status?: 'draft' | 'sent'
}

/** Затрата прихода: сумма с DPH, ставка (сумма без DPH считается на сервере), оплата. */
export interface ReceiptCostInput {
  sum: number | string
  vat?: number
  payment?: OrderPayment
}

export interface ReceiveInput {
  lines: { itemDocId: string; packs: number | string }[]
  complete?: boolean
  note?: string
  /** null — без затраты («částku nevím») */
  cost: ReceiptCostInput | null
}

export const STATUS_LABEL: Record<StockStatus, string> = { ok: 'Skladem', low: 'Málo', out: 'Došlo' }

export const PAYMENT_LABEL: Record<OrderPayment, string> = {
  card: 'Karta salonu',
  cash: 'Hotovost z kasy',
  transfer: 'Převod',
  owner: 'Zaplatil majitel',
}

/**
 * s258: у какого поля формы показать ошибку сервера (по её `code`). Чего нет в словаре —
 * общая строка под формой.
 */
export const STOCK_ERROR_FIELD: Record<string, string> = {
  bad_name: 'name',
  name_required: 'name',
  bad_category: 'category',
  bad_location: 'location',
  location_required: 'location',
  bad_unit: 'unit',
  bad_pack_size: 'packSize',
  bad_min: 'min',
  bad_target: 'target',
  target_below_min: 'target',
  bad_supplier: 'supplier',
  bad_url: 'url',
  bad_price: 'lastPrice',
  bad_count_every: 'countEveryDays',
  bad_note: 'note',
  bad_packs: 'packs',
  bad_units: 'units',
  qty_required: 'units',
}

/** Ошибка → [поле | null, текст]. */
export const stockErrorField = (e: unknown): [string | null, string] => {
  const code = e instanceof ApiError ? e.code : ''
  const text = e instanceof Error ? e.message : 'Nepodařilo se uložit'
  return [STOCK_ERROR_FIELD[code] ?? null, text]
}

/** Подсказка «сколько это в единицах» для дробных упаковок у ml/g: «0,2 bal. = 1000 ml». */
export const packsHint = (packs: string, packSize: number, unit: StockUnit): string | null => {
  if (unit === 'ks' || packSize <= 1) return null
  const n = Number(packs.trim().replace(',', '.'))
  if (packs.trim() === '' || !Number.isFinite(n) || n < 0 || Number.isInteger(n)) return null
  return `${packs.trim()} bal. = ${Math.round(n * packSize * 100) / 100} ${unit}`
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Přihlášení vypršelo — přihlaste se znovu.',
  owner_only: 'Tuto akci může provést jen vedení salonu.',
  not_allowed: 'Sklad není pro tuto roli.',
  edit_not_allowed: 'Tohle může jen vedení salonu.',
  item_not_found: 'Položka nenalezena (možná byla archivována).',
  stock_busy: 'Položku právě mění někdo jiný — zkuste to znovu.',
  // s252: заказы
  order_not_found: 'Objednávka nenalezena.',
  order_busy: 'Objednávku právě změnil někdo jiný — obnovte stránku.',
  order_closed: 'Objednávka je už uzavřená.',
  order_not_open: 'Objednávka není otevřená — obnovte stránku.',
  order_not_draft: 'Objednávka už byla odeslána.',
  order_has_receipts: 'Část objednávky už přišla — měnit ji nejde.',
  nothing_received: 'Zadejte, co přišlo (aspoň jedno balení).',
  cost_exists: 'Náklad k tomuto příjmu už je.',
  no_cost: 'K příjmu není náklad — doklad nahrajte po zapsání nákladu.',
  bad_sum: 'Částka — celé kladné číslo v Kč.',
  sum_too_big: 'Částka je příliš velká — zkontrolujte nuly.',
  file_too_big: 'Soubor je větší než 10 MB.',
  bad_file_type: 'Doklad — fotka (JPG, PNG, WEBP) nebo PDF.',
  storage_not_configured: 'Úložiště dokladů není na serveru nastavené.',
  request_closed: 'Žádost o náklad je už vyřízená.',
}

const stockFetch = makeApiFetch('/api', CODE_MESSAGES, (status) => `Chyba ${status}`)

const id = (docId: string) => encodeURIComponent(docId)

export const fetchStock = (archived = false) =>
  stockFetch<{ items: StockItem[]; meta: StockMeta }>('GET', `/engine/admin/stock${archived ? '?archived=1' : ''}`)

export const fetchStockItem = (docId: string) =>
  stockFetch<{ item: StockItem; moves: StockMove[]; meta: StockMeta }>('GET', `/engine/admin/stock/items/${id(docId)}`)

export const fetchStockOrder = () =>
  stockFetch<{ groups: OrderGroup[]; covered: CoveredItem[]; meta: StockMeta }>('GET', '/engine/admin/stock/order')

export const fetchStockAttention = () => stockFetch<StockAttention>('GET', '/engine/admin/stock/attention')

export const fetchStockSuggest = () => stockFetch<StockSuggest>('GET', '/engine/admin/stock/suggest')

export const fetchStockMoves = (opts: { item?: string; before?: string; limit?: number } = {}) => {
  const q = new URLSearchParams()
  if (opts.item) q.set('item', opts.item)
  if (opts.before) q.set('before', opts.before)
  if (opts.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  return stockFetch<{ moves: StockMove[]; hasMore: boolean }>('GET', `/engine/admin/stock/moves${qs ? `?${qs}` : ''}`)
}

export const createStockItem = (body: StockItemInput) =>
  stockFetch<{ item: StockItem }>('POST', '/engine/admin/stock/items', body)

export const updateStockItem = (docId: string, body: StockItemInput) =>
  stockFetch<{ item: StockItem }>('PATCH', `/engine/admin/stock/items/${id(docId)}`, body)

export const postStockMove = (docId: string, body: MoveInput) =>
  stockFetch<{ item: StockItem; move: StockMove }>('POST', `/engine/admin/stock/items/${id(docId)}/moves`, body)

// ── s252: заказы ──────────────────────────────────────────────────────────────

type OrderRes = { order: StockOrder }

export const fetchStockOrders = () => stockFetch<{ orders: StockOrder[]; meta: OrdersMeta }>('GET', '/engine/admin/stock/orders')

export const createStockOrder = (body: OrderInput) => stockFetch<OrderRes>('POST', '/engine/admin/stock/orders', body)

export const updateStockOrder = (docId: string, body: OrderInput) => stockFetch<OrderRes>('PATCH', `/engine/admin/stock/orders/${id(docId)}`, body)

export const sendStockOrder = (docId: string) => stockFetch<OrderRes>('POST', `/engine/admin/stock/orders/${id(docId)}/send`)

export const closeStockOrder = (docId: string) => stockFetch<OrderRes>('POST', `/engine/admin/stock/orders/${id(docId)}/close`)

export const receiveStockOrder = (docId: string, body: ReceiveInput) =>
  stockFetch<OrderRes & { receipt: number; failed: string[]; costError: string | null }>('POST', `/engine/admin/stock/orders/${id(docId)}/receive`, body)

export const addReceiptCost = (docId: string, receipt: number, cost: ReceiptCostInput) =>
  stockFetch<OrderRes>('POST', `/engine/admin/stock/orders/${id(docId)}/cost`, { receipt, cost })

/** Фото чека к приходу (multipart, как чеки затрат): к затрате или к ждущему запросу. */
export const uploadReceiptFile = async (docId: string, receipt: number, file: File): Promise<void> => {
  const fd = new FormData()
  fd.append('files', file, file.name)
  const res = await fetch(`${API_URL}/api/engine/admin/stock/orders/${id(docId)}/file?receipt=${receipt}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    body: fd,
  })
  if (res.ok) return
  const json = await res.json().catch(() => null)
  const code = json?.error?.code || 'internal'
  throw new ApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Chyba ${res.status}`)
}

/** Адрес QR-ярлыка позиции / места — та же админка, что открыта сейчас. */
export const itemQrUrl = (docId: string): string => `${window.location.origin}/stock/i/${encodeURIComponent(docId)}`
export const locationQrUrl = (slug: string): string => `${window.location.origin}/stock/l/${encodeURIComponent(slug)}`

/** Целые упаковки и остаток штук — чтобы подставить текущий остаток в форму пересчёта. */
export const splitQty = (qty: number, packSize: number): { packs: number; units: number } => {
  if (packSize <= 1) return { packs: 0, units: Math.round(qty * 100) / 100 }
  const packs = Math.floor(qty / packSize + 1e-9)
  return { packs, units: Math.round((qty - packs * packSize) * 100) / 100 }
}
