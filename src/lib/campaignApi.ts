import { API_URL as strapiUrl } from './config'
// Единая точка отправки маркетинговых рассылок из админки (s175).
//
// Раньше все пути (страница «Email kampaň», win-back из «Спящих», письма
// «Дозапись в окно» — удалены в s197) дёргали client-роут /api/send-bulk-email напрямую.
// Роут был открыт в интернет без авторизации, а получателей никто не проверял:
// клиент, ответивший NEZASÍLAT, всё равно получал письмо со скидкой.
//
// Теперь запрос идёт в Strapi (JWT владельца), который сам режет отписавшихся и
// заблокированных и только потом зовёт client-роут с серверным секретом.
// Фильтрация намеренно НЕ здесь: из браузера её можно было бы обойти.

import { getToken } from '../services/auth'

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

export interface VoucherConfirmationInput {
  email: string
  buyerName: string
  recipientName: string
  voucherId: string
  validUntil: string
}

// Письмо «voucher zaplacen» покупателю. Раньше страница «Potvrzení voucheru»
// POST-ила прямо на barbitch.cz/api/send-confirmation-voucher, а тот роут был
// открыт в интернет без авторизации (s181, п. 1.3). Теперь тот же путь, что у
// рассылок: сюда → Strapi (JWT владельца) → client-роут с серверным секретом.
export async function sendVoucherConfirmation(input: VoucherConfirmationInput): Promise<void> {
  const res = await fetch(`${strapiUrl}/api/campaign/voucher-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || 'Nepodařilo se odeslat email')
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
