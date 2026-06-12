import qs from 'qs'
import { Axios } from '../../../../lib/api'
import { getEventsHistory, isAttended, todayStr } from './eventsHistory'

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
    name: 'Win-back — «Chybíte nám»',
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

// Фильтр таба «Спящие» на момент отправки — кому именно слали
export interface CampaignFilters {
  minDays: number // «не были более N дней»
  maxDays: number // «но менее N дней», 0 = без лимита
  minVisits: number
}

// Две строки для компактного чипа: «60–120 дн.» / «2+ визитов»
export const formatFilterParts = (f: CampaignFilters): [string, string] => [
  f.maxDays > 0 ? `${f.minDays}–${f.maxDays} дн.` : `${f.minDays}+ дн.`,
  `${f.minVisits}+ визитов`,
]

export interface CampaignLog {
  documentId: string
  createdAt: string // ISO — момент отправки
  template: string
  subject: string
  count: number
  recipients: CampaignRecipient[]
  filters: CampaignFilters | null // null у старых кампаний (поля ещё не было)
}

// Все кампании (новые сверху)
export const fetchCampaignLogs = async (): Promise<CampaignLog[]> => {
  const logs: CampaignLog[] = []
  // Если Strapi ещё без поля `filters` (старый деплой) — запрос с ним даёт 400
  // «Invalid key filters». Не терять ВЕСЬ лог (защита от дублей!), а ретраить без него.
  let withFilters = true
  let page = 1
  for (;;) {
    const fields = ['template', 'subject', 'count', 'recipients', 'createdAt']
    if (withFilters) fields.splice(4, 0, 'filters')
    const query = qs.stringify(
      {
        fields,
        sort: ['createdAt:desc'],
        pagination: { page, pageSize: 100 },
      },
      { encodeValuesOnly: true },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res: any
    try {
      res = await Axios.get(`/api/email-campaign-logs?${query}`)
    } catch (e) {
      if (withFilters) {
        withFilters = false
        continue
      }
      throw e
    }
    const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : []
    for (const log of data) {
      logs.push({
        documentId: String(log.documentId ?? ''),
        createdAt: String(log.createdAt ?? ''),
        template: String(log.template ?? ''),
        subject: String(log.subject ?? ''),
        count: Number(log.count) || 0,
        recipients: (Array.isArray(log.recipients) ? log.recipients : []) as CampaignRecipient[],
        filters:
          log.filters && typeof log.filters === 'object'
            ? (log.filters as CampaignFilters)
            : null,
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
  filters: CampaignFilters,
): Promise<void> => {
  await Axios.post('/api/email-campaign-logs', {
    data: {
      template,
      subject,
      source: 'sleeping',
      count: recipients.length,
      recipients,
      filters,
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
  // та же статистика, что в основной таблице «Спящие» (считается из истории
  // событий — в списке спящих этих клиентов уже нет, у них есть будущая бронь)
  visits: number // состоявшихся визитов (до сегодня)
  lastVisit: string // 'YYYY-MM-DD' последнего состоявшегося визита ('' если нет)
  daysSince: number // дней с последнего визита
  spent: number // Kč, сумма цен состоявшихся визитов
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

  // По клиентам: активные брони (для поиска записи после отправки) + та же
  // статистика визитов, что в основной таблице спящих (visits/lastVisit/spent)
  interface CustStats {
    activeDates: string[] // не cancelled и не noshow, включая будущие
    visits: number
    lastVisit: string
    spent: number
  }
  const byCustomer = new Map<string, CustStats>()
  for (const e of events) {
    if (!e.customer || e.status === 'cancelled') continue
    let s = byCustomer.get(e.customer)
    if (!s) {
      s = { activeDates: [], visits: 0, lastVisit: '', spent: 0 }
      byCustomer.set(e.customer, s)
    }
    if (e.status !== 'noshow') s.activeDates.push(e.date)
    if (e.date <= today && isAttended(e)) {
      s.visits++
      s.spent += e.price
      if (e.date > s.lastVisit) s.lastVisit = e.date
    }
  }

  const msDay = 24 * 60 * 60 * 1000
  const now = Date.now()
  const daysSinceDate = (date: string): number => {
    if (!date) return 0
    const [y, m, d] = date.split('-').map(Number)
    return Math.floor((now - new Date(y, m - 1, d).getTime()) / msDay)
  }

  return logs.map((log) => {
    const sentDate = log.createdAt.slice(0, 10)
    const converted: CampaignConversion[] = []
    for (const r of log.recipients) {
      if (!r.customerId) continue
      const stats = byCustomer.get(r.customerId)
      const after = (stats?.activeDates ?? [])
        .filter((d) => d > sentDate)
        .sort((a, b) => (a < b ? -1 : 1))
      if (!after.length) continue
      converted.push({
        customerId: r.customerId,
        name: r.name,
        email: r.email,
        bookingDate: after[0],
        attended: after[0] <= today,
        visits: stats?.visits ?? 0,
        lastVisit: stats?.lastVisit ?? '',
        daysSince: daysSinceDate(stats?.lastVisit ?? ''),
        spent: Math.round(stats?.spent ?? 0),
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
