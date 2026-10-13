// Подписи модуля «Sklad» (s251) — отдельным файлом из-за eslint
// `react-refresh/only-export-components` (компонентные файлы экспортируют только компоненты).
import type { CostStatus, StockAttention, StockItem, StockMove } from './fetch/stock'

export const smallCls = 'text-[11.5px] font-semibold text-ink-faint'

/** «počítáno před 3 dny · Julia» / «ještě nepočítáno» */
export const countedText = (item: StockItem): string => {
  if (!item.lastCountedAt) return 'ještě nepočítáno'
  const d = item.daysSinceCount ?? 0
  const when = d === 0 ? 'dnes' : d === 1 ? 'včera' : `před ${d} dny`
  return `počítáno ${when}${item.lastCountedBy ? ` · ${item.lastCountedBy}` : ''}`
}

const KIND_TEXT = { create: 'Nová položka', count: 'Spočítáno', in: 'Přišlo', out: 'Došlo', adjust: 'Oprava' } as const

export const moveKindText = (m: StockMove): string => (m.kind === 'out' && m.mode === 'low' ? 'Dochází' : KIND_TEXT[m.kind])

// ── s252: заказы и сводка ─────────────────────────────────────────────────────

/** «3 bal. (à 100 ks)» / «2 ks» — как в тексте заказа сервера. */
export const packsText = (packs: number, packSize: number, unit: string): string =>
  packSize > 1 ? `${packs} bal. (à ${packSize} ${unit})` : `${packs} ${unit}`

/** Затрата прихода — подпись и тон бейджа. */
export const COST_STATUS_TEXT: Record<CostStatus, { label: string; tone: 'pos' | 'warn' | 'neg' | 'faint' }> = {
  recorded: { label: 'Náklad zapsán', tone: 'pos' },
  approved: { label: 'Náklad schválen', tone: 'pos' },
  pending: { label: 'Náklad čeká na schválení', tone: 'warn' },
  rejected: { label: 'Náklad zamítnut', tone: 'neg' },
  failed: { label: 'Náklad se nezapsal', tone: 'neg' },
  none: { label: 'Bez nákladu', tone: 'faint' },
}

/**
 * Сколько пунктов склада требует внимания (счётчик карточки «Склад»): закончилось / ниже минимума
 * и ещё не заказано, заказы не пришли в срок, руководству — приходы без затраты; инвентура
 * этой недели — администратору всегда, руководству со вторника (в понедельник это дело администратора).
 */
export const stockAttentionCount = (d: StockAttention, { forAdmin = false }: { forAdmin?: boolean } = {}): number => {
  const items = [...d.out, ...d.low].filter((i) => !i.onOrder).length
  const overdue = d.orders?.overdue.length ?? 0
  const needsCost = forAdmin ? 0 : (d.orders?.needsCost ?? 0)
  const inv = d.inventory && d.inventory.remaining > 0 && (forAdmin || !d.inventory.isMonday) ? 1 : 0
  return items + overdue + needsCost + inv
}
