// Единая точка отправки маркетинговых рассылок из админки (s175).
//
// Раньше все три пути (страница «Email kampaň», win-back из «Спящих»,
// cross-sell свободных окон) дёргали client-роут /api/send-bulk-email напрямую.
// Роут был открыт в интернет без авторизации, а получателей никто не проверял:
// клиент, ответивший NEZASÍLAT, всё равно получал письмо со скидкой.
//
// Теперь запрос идёт в Strapi (JWT владельца), который сам режет отписавшихся и
// заблокированных и только потом зовёт client-роут с серверным секретом.
// Фильтрация намеренно НЕ здесь: из браузера её можно было бы обойти.

import { getToken } from '../services/auth'

const strapiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export interface CampaignRecipientInput {
  email: string
  variables?: Record<string, string>
}

export interface CampaignSkipped {
  invalid: number
  duplicate: number
  optOut: number
  blacklisted: number
  noConsent: number
}

export interface CampaignSendResult {
  total: number
  successful: number
  failed: number
  skipped: CampaignSkipped
  skippedDetail: Array<{ email: string; reason: string }>
  acceptedEmails: string[]
  requireConsent: boolean
}

export const SKIP_REASON_LABEL: Record<string, string> = {
  optOut: 'отписался (NEZASÍLAT)',
  blacklisted: 'в чёрном списке',
  noConsent: 'нет согласия на рассылку',
  invalid: 'некорректный адрес',
}

export async function sendCampaign(
  template: string,
  subject: string,
  recipients: CampaignRecipientInput[],
  source = 'admin',
): Promise<CampaignSendResult> {
  const res = await fetch(`${strapiUrl}/api/campaign/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: JSON.stringify({ template, subject, recipients, source }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || 'Odeslání selhalo')
  return data as CampaignSendResult
}

// «отписался 2, в чёрном списке 1» — короткая сводка для плашки в UI
export const skippedSummary = (s: CampaignSkipped | undefined): string => {
  if (!s) return ''
  const parts: string[] = []
  if (s.optOut) parts.push(`отписались: ${s.optOut}`)
  if (s.blacklisted) parts.push(`в чёрном списке: ${s.blacklisted}`)
  if (s.noConsent) parts.push(`без согласия: ${s.noConsent}`)
  if (s.invalid) parts.push(`битый адрес: ${s.invalid}`)
  if (s.duplicate) parts.push(`дубли: ${s.duplicate}`)
  return parts.join(', ')
}
