// Форматтеры и константы «Лояльности». Перенесено из LoyaltyPage.tsx (этап 6) дословно.

export const REASON_LABELS: Record<string, string> = {
  visit: 'визит',
  manual: 'корректировка',
  signup: 'регистрация',
  referral: 'рефералка',
}

export const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const PAGE_SIZE = 25
