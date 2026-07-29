// Verify-флаги записи «Оказанная услуга» — метаданные для UI + разбор скидки.
//
// Вынесено из shiftClose.ts отдельным лёгким модулем: те же данные нужны drawer'у
// календаря (карточка «Návštěva uzavřena»), а тянуть туда весь shiftClose нельзя —
// он тащит за собой mirror/dashboard-фетчи и раздувает чанк календаря.
// Зеркало strapi/src/utils/verify-flags.ts — держать в синхроне.

export type VerifyFlag =
  | 'ok'
  | 'sleva'
  | 'ztrata'
  | 'salon_up'
  | 'mistr_up'
  | 'mistr_down'
  | 'internal'
  | 'sleva_bez_karty'

export const VERIFY_FLAGS: VerifyFlag[] = [
  'ok',
  'internal',
  'sleva',
  'sleva_bez_karty',
  'salon_up',
  'mistr_up',
  'mistr_down',
  'ztrata',
]

export interface FlagMeta {
  emoji: string
  label: string
  chipCls: string
  dotCls: string
  // severity for overall page status: 0 = ok/info, 1 = warning, 2 = error
  severity: 0 | 1 | 2
}

export const FLAG_META: Record<VerifyFlag, FlagMeta> = {
  ok: {
    emoji: '🟩',
    label: 'OK',
    chipCls: 'bg-green-100 text-green-800',
    dotCls: 'bg-green-500',
    severity: 0,
  },
  sleva: {
    emoji: '🟦',
    label: 'Sleva',
    chipCls: 'bg-blue-100 text-blue-800',
    dotCls: 'bg-blue-500',
    severity: 0,
  },
  ztrata: {
    emoji: '🟥',
    label: 'Ztráta salonu',
    chipCls: 'bg-red-100 text-red-800',
    dotCls: 'bg-red-500',
    severity: 2,
  },
  salon_up: {
    emoji: '🟪',
    label: 'Salon dostal víc',
    chipCls: 'bg-purple-100 text-purple-800',
    dotCls: 'bg-purple-500',
    severity: 1,
  },
  mistr_up: {
    emoji: '🟨↑',
    label: 'Mistr dostal víc',
    chipCls: 'bg-yellow-100 text-yellow-800',
    dotCls: 'bg-yellow-500',
    severity: 1,
  },
  mistr_down: {
    emoji: '🟨↓',
    label: 'Mistr dostal míň',
    chipCls: 'bg-amber-100 text-amber-800',
    dotCls: 'bg-amber-500',
    severity: 1,
  },
  internal: {
    emoji: '🤝',
    label: 'Interní služba',
    chipCls: 'bg-indigo-100 text-indigo-800',
    dotCls: 'bg-indigo-500',
    severity: 0,
  },
  sleva_bez_karty: {
    emoji: '🎟',
    label: 'Sleva mimo bitchcard',
    chipCls: 'bg-teal-100 text-teal-800',
    dotCls: 'bg-teal-500',
    severity: 0,
  },
}

// Скидка → доля 0..1 от полной цены.
// Принимает процент («20%», «20», «0.2») или сумму в кронах («400»): процент не может
// быть больше 100, поэтому значения >100 трактуются как кроны. 1..100 остаются
// процентами («50» = 50 %, не 50 Kč) — гоча s81.
export const parseSaleRate = (raw: unknown, offerPrice: number): number => {
  let n = 0
  if (typeof raw === 'number') n = Number.isFinite(raw) ? raw : 0
  else if (typeof raw === 'string') {
    const m = raw.match(/(-?\d+(?:[.,]\d+)?)/)
    n = m ? parseFloat(m[1].replace(',', '.')) : 0
  }
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n <= 1) return n
  if (n <= 100) return n / 100
  return offerPrice > 0 ? Math.min(n / offerPrice, 1) : 0
}
