// 🟥 Отправка писем клиентам + журнал. Перенесено из windowCrossSell.ts
// (этап 6) ДОСЛОВНО: тема, шаблоны и параметры ссылки не менялись ни в букве.
import { Axios } from '../../../../../lib/api'
import { type CampaignSendResult, type CampaignSkipped, emptyCampaignSkipped, sendCampaign } from '../../../../../lib/campaignApi'
import type { CrossSellCandidate } from '../windowCrossSell'
import { BUCKET_LABEL_CS } from './buckets'
import { fmtCsDateLong } from './format'

// ─── Отправка + лог ───────────────────────────────────────────────────────────
// skipped — разбивка отсева от Strapi (отписался / чёрный список / без согласия);
// суммируется по обоим шаблонам (senior + junior).
// Итог отправки, сложенный по ДВУМ шаблонам (senior + junior): счётчики те же,
// что у одного батча, а поадресных полей (skippedDetail, acceptedEmails) у суммы
// быть не может — они разбираются на месте, до сложения.
export type SendResult = Pick<CampaignSendResult, 'total' | 'successful' | 'failed' | 'skipped'>

export const emptySkipped = emptyCampaignSkipped

export const TEMPLATE = 'window-cross-sell'
export const TEMPLATE_JUNIOR = 'window-cross-sell-junior'
export const SUBJECT = 'Hned po vaší návštěvě máme volný termín — se slevou 💕'
export const SUBJECT_JUNIOR = 'Zkuste nehty u naší junior mistrové — výhodně 💅'

// Параметры атрибуции в ссылку: src=win (метка письма), disc (числом), d (дата →
// клиент сразу попадает на нужный день). На клиенте src/disc сохраняются в
// localStorage (bb_offer) и попадают в комментарий брони.
export const offerUrl = (c: CrossSellCandidate, discount: string): string => {
  const discNum = discount.match(/\d+/)?.[0] ?? ''
  return `${c.bookingUrl}?src=win&d=${c.date}${discNum ? `&disc=${discNum}` : ''}`
}

// Один батч писем (один шаблон). Возвращает счётчики Resend.
export const postBulk = async (
  template: string,
  subject: string,
  cands: CrossSellCandidate[],
  discount: string,
): Promise<CampaignSendResult> => {
  // Через Strapi (api::campaign): гейт владельца + отсев отписавшихся и
  // заблокированных. Напрямую в client-роут больше не ходим — он закрыт
  // серверным секретом (s175).
  return sendCampaign(
    template,
    subject,
    cands.map((c) => ({
      email: c.email,
      variables: {
        name: c.customerName,
        anchorLabel: BUCKET_LABEL_CS[c.anchorBucket],
        offerLabel: BUCKET_LABEL_CS[c.offerBucket], // категория предложения (manikúra/obočí/řasy)
        date: fmtCsDateLong(c.date),
        time: c.windowStartHHMM,
        service: c.serviceTitle,
        master: c.masterName,
        discount,
        bookingUrl: offerUrl(c, discount),
      },
    })),
    'window-cross-sell',
  )
}

export const sendCrossSellOffers = async (
  cands: CrossSellCandidate[],
  discount: string,
): Promise<SendResult> => {
  if (!cands.length) return { total: 0, successful: 0, failed: 0, skipped: emptySkipped() }

  // Junior получают ДРУГОЕ письмо (−20% уже в цене + −discount за дозапись).
  const senior = cands.filter((c) => !c.isJunior)
  const junior = cands.filter((c) => c.isJunior)
  const parts = await Promise.all([
    senior.length ? postBulk(TEMPLATE, SUBJECT, senior, discount) : Promise.resolve(null),
    junior.length
      ? postBulk(TEMPLATE_JUNIOR, SUBJECT_JUNIOR, junior, discount)
      : Promise.resolve(null),
  ])
  const agg: SendResult = { total: 0, successful: 0, failed: 0, skipped: emptySkipped() }
  // адреса, которые Strapi реально принял (остальные отсеяны как отписавшиеся,
  // заблокированные и т.п.) — по ним же пишем лог предложений
  const accepted = new Set<string>()
  for (const p of parts) {
    if (!p) continue
    agg.total += p.total
    agg.successful += p.successful
    agg.failed += p.failed
    for (const k of Object.keys(agg.skipped) as Array<keyof CampaignSkipped>) {
      agg.skipped[k] += p.skipped?.[k] ?? 0
    }
    for (const e of p.acceptedEmails || []) accepted.add(e.toLowerCase())
  }

  // Лог ТОЛЬКО по реально отправленным: иначе отписавшийся клиент считался бы
  // «уже получившим предложение» и выпал бы из будущих подборок ни за что.
  const sentAt = new Date().toISOString()
  await Promise.all(
    cands
      .filter((c) => accepted.has(String(c.email || '').toLowerCase()))
      .map((c) =>
      Axios.post('/api/window-offer-logs', {
        data: {
          bookingEventId: c.bookingEventId,
          offeredCategory: c.isJunior ? 'manicure-junior' : c.offerBucket,
          customerId: c.customerId,
          customerName: c.customerName,
          email: c.email,
          masterId: c.masterId,
          masterName: c.masterName,
          serviceId: c.serviceId,
          serviceTitle: c.serviceTitle,
          anchorDate: c.date,
          windowTime: c.windowStartHHMM,
          discount,
          sentAt,
        },
      }).catch(() => null),
    ),
  )

  return agg
}
