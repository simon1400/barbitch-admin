// Модель формы услуги и ограничения мастеров. Перенесено из CatalogPage.tsx
// (этап 6) дословно.
import type { CatalogModifier, CatalogRestriction, ServicePayload } from '../fetch/bookingCatalog'
import { toModifierKey } from '../fetch/bookingCatalog'

export interface EditorState {
  documentId: string | null // null = создание новой услуги
  payload: ServicePayload
  masterIds: Set<string>
}

export const EMPTY_PAYLOAD: ServicePayload = {
  title: '',
  category: '',
  categoryOrder: 0,
  order: 0,
  price: 0,
  durationMin: 60,
  description: '',
  active: true,
  onlineBookable: true,
  variants: [],
  modifiers: [],
  restrictions: [],
}

// ── ограничения мастеров по варианту/дополнению ──
// null = разрешено всё, массив = белый список, [] = только базовая услуга.
// Записи «разрешено всё» в БД не хранятся: их убирает cleanRestrictions при сохранении.

export const modKeyOf = (m: CatalogModifier) => (m.key || toModifierKey(m.label)).trim()

export const isLimited = (r: CatalogRestriction | null | undefined) =>
  Boolean(r && (r.allowedVariants !== null || r.allowedModifiers !== null))

// Подпись на чипе мастера: «варианты 2/4 · допы 5/11».
export const limitSummary = (
  r: CatalogRestriction | null | undefined,
  variants: number,
  modifiers: number,
) => {
  if (!r) return String()
  const parts: string[] = []
  if (r.allowedVariants !== null) parts.push(`варианты ${r.allowedVariants.length}/${variants}`)
  if (r.allowedModifiers !== null) parts.push(`допы ${r.allowedModifiers.length}/${modifiers}`)
  return parts.join(" · ")
}

// Перед отправкой: выкидываем мастеров, снятых с услуги, и значения удалённых/
// переименованных вариантов и дополнений; «разрешено всё» схлопываем в null.
export const cleanRestrictions = (p: ServicePayload, masterIds: Set<string>): CatalogRestriction[] => {
  const labels = p.variants.map((v) => v.label.trim()).filter(Boolean)
  const keys = p.modifiers.map(modKeyOf).filter(Boolean)
  const out: CatalogRestriction[] = []
  for (const r of p.restrictions) {
    if (!masterIds.has(r.personalDocId)) continue
    let allowedVariants = r.allowedVariants
      ? r.allowedVariants.filter((x) => labels.includes(x))
      : null
    let allowedModifiers = r.allowedModifiers
      ? r.allowedModifiers.filter((x) => keys.includes(x))
      : null
    if (allowedVariants && allowedVariants.length === labels.length) allowedVariants = null
    if (allowedModifiers && allowedModifiers.length === keys.length) allowedModifiers = null
    if (allowedVariants === null && allowedModifiers === null) continue
    out.push({ personalDocId: r.personalDocId, allowedVariants, allowedModifiers })
  }
  return out
}
