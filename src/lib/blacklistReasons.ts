// Причина блокировки клиента (s208). Без неё в blacklist не добавить: чёрный список —
// обработка персональных данных, и по запросу клиента салон обязан назвать причину.
//
// Ключи — те же, что BLACKLIST_REASON_KEYS на сервере (client-dedupe.ts); подписи
// держит админка. В базе причина лежит строкой «<ключ>: <комментарий>» либо только
// ключом; у старых карточек из Content Manager — свободным текстом.
import { ApiError } from './apiFetch'

export type BlacklistReasonKey = 'noshow' | 'late_cancel' | 'behaviour' | 'other'

export const BLACKLIST_REASONS: { key: BlacklistReasonKey; label: string }[] = [
  { key: 'noshow', label: 'Opakované neomluvené absence' },
  { key: 'late_cancel', label: 'Opakovaná pozdní zrušení' },
  { key: 'behaviour', label: 'Nevhodné chování' },
  { key: 'other', label: 'Jiné' },
]

/** комментарий обязателен только у «Jiné» — зеркало серверного comment_required */
export const blacklistCommentRequired = (key: BlacklistReasonKey | null) => key === 'other'

/** строка для сервера: «ключ» или «ключ: комментарий» */
export const composeBlacklistReason = (key: BlacklistReasonKey, comment: string): string => {
  const c = comment.trim()
  return c ? `${key}: ${c}` : key
}

/** человеческая подпись сохранённой причины; свободный текст старых карточек — как есть */
export const describeBlacklistReason = (stored: string | null | undefined): string | null => {
  const raw = (stored ?? '').trim()
  if (!raw) return null
  const m = /^([a-z_]+)(?:\s*:\s*([\s\S]*))?$/.exec(raw)
  const hit = m && BLACKLIST_REASONS.find((r) => r.key === m[1])
  if (!hit) return raw
  const comment = (m[2] || '').trim()
  return comment ? `${hit.label} · ${comment}` : hit.label
}

const ERRORS_CS: Record<string, string> = {
  reason_required: 'Vyberte důvod přidání na blacklist.',
  comment_required: 'U důvodu „Jiné“ doplňte komentář.',
  client_not_found: 'Karta klienta nenalezena.',
  unauthorized: 'Přihlášení vypršelo — přihlaste se znovu.',
}

/** текст ошибки для календаря (весь чешский); словарь clientDedupe — русский */
export const blacklistErrorCs = (e: unknown): string =>
  (e instanceof ApiError && ERRORS_CS[e.code]) || (e as Error).message || 'Uložení se nezdařilo'
