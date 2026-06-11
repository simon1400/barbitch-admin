import qs from 'qs'
import { Axios } from '../../../../lib/api'

// Отправка win-back кампаний из таба «Спящие» + лог рассылок.
// Лог: Strapi `email-campaign-log`, ОДНА запись = ОДНА кампания
// (recipients — json-массив; по-письмово было бы ~300 POST-ов через pooler).
// Письма шлются через СУЩЕСТВУЮЩИЙ client-роут /api/send-bulk-email (Resend,
// шаблоны в client/src/app/api/email-templates/*.html, переменная {{name}}).

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL as string

export interface CampaignExtraVar {
  key: string // {{key}} в html-шаблоне
  label: string
  defaultValue: string
}

export interface CampaignTemplate {
  key: string // имя html-файла шаблона на клиенте
  name: string
  subject: string
  extras: CampaignExtraVar[] // кампейн-переменные (одинаковы для всех получателей)
}

const plusDays = (days: number): string => {
  const d = new Date(Date.now() + days * 86400000)
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

// Новый шаблон = html-файл в client/src/app/api/email-templates/ + строка здесь
export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: 'win-back',
    name: 'Win-back — «Chybíte nám» (спящие клиенты)',
    subject: 'Chybíte nám! Máme pro vás slevu 💕',
    extras: [
      { key: 'discount', label: 'Скидка (текст в письме)', defaultValue: '20 %' },
      { key: 'validUntil', label: 'Действует до', defaultValue: plusDays(30) },
    ],
  },
  {
    key: 'birthday-discount',
    name: 'Narozeninová sleva',
    subject: 'Slavíme 1 rok - Vaše exkluzivní sleva 30%!',
    extras: [
      { key: 'discount', label: 'Скидка', defaultValue: '30%' },
      { key: 'validUntil', label: 'Действует до', defaultValue: plusDays(30) },
    ],
  },
]

export interface CampaignRecipient {
  customerId: string
  email: string
  name: string
  daysAway?: string // «98 dní» / «přes 4 měsíce» — для {{daysAway}} в win-back
}

// Человеческая давность по-чешски (для строки «UŽ JE TO …» в письме)
export const daysAwayLabel = (days: number): string => {
  if (days < 60) return `${days} dní`
  const m = Math.floor(days / 30)
  return `přes ${m} ${m >= 5 ? 'měsíců' : 'měsíce'}`
}

export interface SentInfo {
  lastSentAt: string // ISO
  template: string
}

// customerId → последняя отправка (по всем кампаниям)
export const fetchLastSentMap = async (): Promise<Map<string, SentInfo>> => {
  const map = new Map<string, SentInfo>()
  let page = 1
  for (;;) {
    const query = qs.stringify(
      {
        fields: ['template', 'recipients', 'createdAt'],
        sort: ['createdAt:asc'],
        pagination: { page, pageSize: 100 },
      },
      { encodeValuesOnly: true },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await Axios.get<any>(`/api/email-campaign-logs?${query}`)
    const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : []
    for (const log of data) {
      const recipients = Array.isArray(log.recipients) ? log.recipients : []
      const sentAt = String(log.createdAt ?? '')
      const template = String(log.template ?? '')
      for (const r of recipients as Array<{ customerId?: string }>) {
        if (!r.customerId) continue
        // sort=asc → последняя запись перезапишет более раннюю
        map.set(r.customerId, { lastSentAt: sentAt, template })
      }
    }
    if (data.length < 100) break
    page++
  }
  return map
}

export const saveCampaignLog = async (
  template: string,
  subject: string,
  recipients: CampaignRecipient[],
): Promise<void> => {
  await Axios.post('/api/email-campaign-logs', {
    data: {
      template,
      subject,
      source: 'sleeping',
      count: recipients.length,
      recipients,
    },
  })
}

export interface SendResult {
  total: number
  successful: number
  failed: number
}

export const sendBulkEmail = async (
  template: string,
  subject: string,
  recipients: CampaignRecipient[],
  extraVariables: Record<string, string> = {},
): Promise<SendResult> => {
  const res = await fetch(`${CLIENT_URL}/api/send-bulk-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template,
      subject,
      recipients: recipients.map((r) => ({
        email: r.email,
        variables: { ...extraVariables, name: r.name, daysAway: r.daysAway ?? '' },
      })),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Send failed')
  return { total: data.total ?? 0, successful: data.successful ?? 0, failed: data.failed ?? 0 }
}

export const daysSinceIso = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
