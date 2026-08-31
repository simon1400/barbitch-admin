// Общие хелперы/константы модалов календаря. Не-компонентные экспорты живут
// здесь (не в ui.tsx) — eslint react-refresh/only-export-components запрещает
// смешивать компоненты и константы в одном файле.

import type { CalendarBooking } from '../fetch/calendarDay'
import { JUNIOR_DISCOUNT_PERCENT, type BookingRedemption, type CatalogService } from '../fetch/engineApi'
import { fmtHM } from '../utils'

export { fmtHM }

// ── превью пересчёта цены при переносе к мастеру другого тира ──
// Зеркало серверной логики (adminPatchBooking): цена берётся из seniorPrice снапшота
// брони, junior платит −20 %. Сервер — источник истины, здесь только подсказка админу.

export interface TierRepricePreview {
  tier: 'senior' | 'junior'
  from: number
  to: number
  // причина, по которой сервер цену НЕ тронет (ручная цена/скидка или зеркальная бронь)
  blocked: 'price_override' | 'no_snapshot' | null
}

export const previewTierReprice = (
  booking: Pick<CalendarBooking, 'services' | 'totalPrice' | 'priceOverride'>,
  fromTier: 'senior' | 'junior' | undefined,
  toTier: 'senior' | 'junior' | undefined,
): TierRepricePreview | null => {
  const tier = toTier === 'junior' ? 'junior' : 'senior'
  const prevTier = fromTier === 'junior' ? 'junior' : 'senior'
  const from = Number(booking.totalPrice) || 0
  // ручная цена / системная скидка (bitchcard, дозапись) — сервер репрайс пропустит;
  // предупреждаем только когда тир реально меняется
  if (booking.priceOverride) {
    return prevTier === tier ? null : { tier, from, to: from, blocked: 'price_override' }
  }
  const snap = booking.services || []
  if (!snap.length || snap.some((s) => !Number.isFinite(Number(s.seniorPrice)))) {
    return prevTier === tier ? null : { tier, from, to: from, blocked: 'no_snapshot' }
  }
  const to = snap.reduce(
    (sum, s) =>
      sum +
      (tier === 'junior'
        ? Math.round(Number(s.seniorPrice) * (1 - JUNIOR_DISCOUNT_PERCENT / 100))
        : Number(s.seniorPrice)),
    0,
  )
  return to === from ? null : { tier, from, to, blocked: null }
}

// ── превью пересчёта применённой скидки при смене состава услуг (s174) ──
// Зеркало серверного `_repriceDiscountOnServiceChange`: цена собирается заново от
// каталога, поэтому уже применённая скидка (bitchcard / дозапись) считается от
// НОВОЙ суммы. Сервер — источник истины, здесь только подсказка админу ДО сохранения.

export interface DiscountRepricePreview {
  label: string
  totalPrice: number
  discountKc: number
}

export const previewDiscountReprice = (
  booking: Pick<CalendarBooking, 'discount'>,
  usedRedemption: BookingRedemption | null,
  basePrice: number,
): DiscountRepricePreview | null => {
  if (usedRedemption?.reward) {
    const value = Number(usedRedemption.reward.discountValue) || 0
    const totalPrice =
      usedRedemption.reward.discountType === 'percent'
        ? Math.round(basePrice * (1 - value / 100))
        : Math.max(0, basePrice - Math.round(value))
    return { label: usedRedemption.reward.title, totalPrice, discountKc: basePrice - totalPrice }
  }
  const d = booking.discount
  if (d && d.type === 'rebook' && d.applied && Number(d.percent) > 0) {
    const totalPrice = Math.round(basePrice * (1 - Number(d.percent) / 100))
    return {
      label: `Sleva za dozápis ${d.percent} %`,
      totalPrice,
      discountKc: basePrice - totalPrice,
    }
  }
  return null
}

export const toMin = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

// Слоты времени броней и блоков: 10:00–19:00, шаг 15 мин — как на сайте
// (STEP_MIN=15 в strapi slots-core). Отдаются десктопным TimeSelect (modals/ui).
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let m = 10 * 60; m <= 19 * 60; m += 15) out.push(fmtHM(m))
  return out
})()

// Дни недели: value = getUTCDay (0=Ne..6=So), порядок Po..Ne
export const WEEKDAYS: { v: number; label: string }[] = [
  { v: 1, label: 'Po' },
  { v: 2, label: 'Út' },
  { v: 3, label: 'St' },
  { v: 4, label: 'Čt' },
  { v: 5, label: 'Pá' },
  { v: 6, label: 'So' },
  { v: 0, label: 'Ne' },
]

export const addDays = (d: string, n: number): string =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

export const weekdayOf = (d: string): number => new Date(`${d}T00:00:00Z`).getUTCDay()

export const blokPlural = (n: number): string =>
  n === 1 ? 'blok' : n >= 2 && n <= 4 ? 'bloky' : 'bloků'

export const inputCls =
  'w-full min-h-11 rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:min-h-0 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-100 dark:[color-scheme:dark] dark:placeholder:text-gray-500'
export const labelCls = 'mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400'

// Кнопки футера модалов: на тач-экране ≥44px высоты, на десктопе компактные
export const btnPrimaryCls =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40 sm:min-h-[38px]'
export const btnSecondaryCls =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 sm:min-h-[38px] dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]'

// Выбор в пикере услуги (ServicePicker) — общий для «Nová rezervace» и «Změnit službu»
export interface ServiceSelection {
  service: CatalogService | null
  variantLabel: string
  modKeys: string[]
}
export const EMPTY_SERVICE_SELECTION: ServiceSelection = { service: null, variantLabel: '', modKeys: [] }

// ── Разбор `summary` на «kdo · kdy · co se změnilo» ────────────────────────────
// Движок пишет журнал одной строкой вида
//   «Změna služby: Jana N. · po 31.8. 13:00 · Gel lak → Gel lak + Design basic»
// Читать её сплошняком тяжело, поэтому строка раскладывается на части:
//   subject — кого/чего касается (клиент у броней, мастер у блоков)
//   when    — термин (день + время), выравнивается вправо
//   changes — пары «старое → новое» (перенос, смена услуги, правка блока)
//   notes   — всё остальное (мастер у новой брони, название блока, «čeká na schválení»)
// Префикс до первого «: » не парсится — он дублирует бейдж действия.
export interface ParsedSummary {
  subject: string
  when: string
  changes: { from: string; to: string }[]
  notes: string[]
}

// Чешские сокращения дня недели из fmtDay движка («po 31.8.»); время — «13:00», «13:00–13:30»
const DAY_RE = /^(po|út|st|čt|pá|so|ne)\s/
const TIME_RE = /^\d{1,2}:\d{2}/

export const parseSummary = (raw: string | null): ParsedSummary => {
  const s = (raw || '').trim()
  const cut = s.indexOf(': ')
  const segs = (cut < 0 ? s : s.slice(cut + 2))
    .split(' · ')
    .map((x) => x.trim())
    .filter(Boolean)

  let day = ''
  const whenParts: string[] = []
  const changes: { from: string; to: string }[] = []
  const notes: string[] = []

  // Стрелка без реального изменения бывает двух видов:
  //   «12:00 → 12:00» — менялся только мастер, время просто уточняет термин;
  //   «Gel lak → Gel lak» — админ пересохранил услугу, ничего не изменив (на проде 3 записи).
  // Во втором случае название услуги в термин пускать нельзя — уводим в примечания.
  const pushArrow = (seg: string) => {
    const at = seg.indexOf('→')
    const from = seg.slice(0, at).trim()
    const to = seg.slice(at + 1).trim()
    if (from !== to) changes.push({ from, to })
    else if (TIME_RE.test(from)) whenParts.push(from)
    else notes.push(from)
  }

  // первый сегмент — имя клиента/мастера; но оно бывает пустым (у брони без имени,
  // у блока без мастера), и тогда на его месте оказывается дата — subject остаётся пустым
  const head = segs[0] || ''
  const hasSubject = !!head && !DAY_RE.test(head) && !TIME_RE.test(head) && !head.includes('→')

  for (const seg of segs.slice(hasSubject ? 1 : 0)) {
    if (DAY_RE.test(seg)) {
      const words = seg.split(' ')
      const tail = words.slice(2).join(' ')
      if (day) {
        // второй сегмент с датой (не бывает в текущих форматах) — кладём целиком,
        // чтобы ничего не потерять
        whenParts.push(seg)
      } else {
        day = words.slice(0, 2).join(' ')
        if (tail.includes('→')) pushArrow(tail)
        // «po 31.8. – pá 4.9. (5×)» — диапазон дат серии блоков остаётся при дне
        else if (/^[–-]/.test(tail)) day = `${day} ${tail}`
        else if (tail) whenParts.push(tail)
      }
    } else if (seg.includes('→')) {
      pushArrow(seg)
    } else if (TIME_RE.test(seg)) {
      whenParts.push(seg)
    } else {
      notes.push(seg)
    }
  }

  return {
    subject: hasSubject ? head : '',
    when: [day, ...whenParts].filter(Boolean).join(' · '),
    changes,
    notes,
  }
}
