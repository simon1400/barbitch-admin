import qs from 'qs'
import { Axios } from '../../../../lib/api'
import { getEventsHistory, todayStr } from './eventsHistory'

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

export interface CampaignLog {
  documentId: string
  createdAt: string // ISO — момент отправки
  template: string
  subject: string
  count: number
  recipients: CampaignRecipient[]
}

// Все кампании (новые сверху)
export const fetchCampaignLogs = async (): Promise<CampaignLog[]> => {
  const logs: CampaignLog[] = []
  let page = 1
  for (;;) {
    const query = qs.stringify(
      {
        fields: ['template', 'subject', 'count', 'recipients', 'createdAt'],
        sort: ['createdAt:desc'],
        pagination: { page, pageSize: 100 },
      },
      { encodeValuesOnly: true },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await Axios.get<any>(`/api/email-campaign-logs?${query}`)
    const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : []
    for (const log of data) {
      logs.push({
        documentId: String(log.documentId ?? ''),
        createdAt: String(log.createdAt ?? ''),
        template: String(log.template ?? ''),
        subject: String(log.subject ?? ''),
        count: Number(log.count) || 0,
        recipients: (Array.isArray(log.recipients) ? log.recipients : []) as CampaignRecipient[],
      })
    }
    if (data.length < 100) break
    page++
  }
  return logs
}

// customerId → последняя отправка (по всем кампаниям)
export const buildLastSentMap = (logs: CampaignLog[]): Map<string, SentInfo> => {
  const map = new Map<string, SentInfo>()
  // logs отсортированы desc → берём первую встреченную (самую свежую)
  for (const log of logs) {
    for (const r of log.recipients) {
      if (!r.customerId || map.has(r.customerId)) continue
      map.set(r.customerId, { lastSentAt: log.createdAt, template: log.template })
    }
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

// ─── Конверсия кампаний: кто из получателей реально записался ПОСЛЕ отправки ──
// Спящие на момент отправки НЕ имели будущей брони → любая активная запись
// с датой ПОЗЖЕ дня отправки гарантированно создана после письма.

export interface CampaignConversion {
  customerId: string
  name: string
  email: string
  bookingDate: string // первая запись после отправки, 'YYYY-MM-DD'
  attended: boolean // уже была (визит состоялся) или ещё только записана
}

export interface CampaignResult {
  log: CampaignLog
  converted: CampaignConversion[]
  pct: number // % записавшихся от получателей
}

export const getCampaignResults = async (logs: CampaignLog[]): Promise<CampaignResult[]> => {
  if (!logs.length) return []
  const events = await getEventsHistory()
  const today = todayStr()

  // активные события по клиентам (включая будущие — они в кэше истории)
  const byCustomer = new Map<string, Array<{ date: string; status: string }>>()
  for (const e of events) {
    if (!e.customer || e.status === 'cancelled') continue
    if (!byCustomer.has(e.customer)) byCustomer.set(e.customer, [])
    byCustomer.get(e.customer)!.push({ date: e.date, status: e.status })
  }

  return logs.map((log) => {
    const sentDate = log.createdAt.slice(0, 10)
    const converted: CampaignConversion[] = []
    for (const r of log.recipients) {
      if (!r.customerId) continue
      const after = (byCustomer.get(r.customerId) || [])
        .filter((e) => e.date > sentDate && e.status !== 'noshow')
        .sort((a, b) => (a.date < b.date ? -1 : 1))
      if (!after.length) continue
      converted.push({
        customerId: r.customerId,
        name: r.name,
        email: r.email,
        bookingDate: after[0].date,
        attended: after[0].date <= today,
      })
    }
    return {
      log,
      converted,
      pct: log.recipients.length
        ? Math.round((converted.length / log.recipients.length) * 100)
        : 0,
    }
  })
}
