// Одна СТРОКА варианта дозаписи: мастер · время · услуга · цена · комиссия · кнопка.
// Режим (hned po / před) показывает заголовок группы в ClientCard, а не строка (s198).
// На десктопе — шесть колонок общей сетки (колонки выровнены по всем карточкам),
// на телефоне — три строки: обёртки с `md:contents` растворяются в сетке.
import { useState } from 'react'

import { badgeBaseCls, btnPinkCls } from '../../../ui/kit'
import { kc, kcNum } from '../../../utils/money'
import type { UpsellOffer, UpsellService } from '../fetch/upsellApi'
import { ChevronDown } from './icons'

interface Props {
  offer: UpsellOffer
  busy: boolean
  onBook: (offer: UpsellOffer, svc: UpsellService) => void
}

/** Сетка строки на десктопе: мастер · время · услуга · цена · комиссия · кнопка. */
const rowCls =
  'flex flex-col gap-2 py-2.5 border-t border-line-soft ' +
  'md:grid md:grid-cols-[160px_96px_minmax(0,1fr)_120px_64px_92px] md:gap-3 md:items-center md:py-2'

const juniorBadgeCls = `${badgeBaseCls} text-junior bg-junior-bg uppercase tracking-[0.04em] !text-[10px] rounded-full`

const selectCls =
  'h-[34px] w-full box-border pl-3 pr-8 rounded-lg border border-transparent bg-surface-input text-[13px] font-semibold text-ink appearance-none cursor-pointer truncate ' +
  'focus:outline-none focus:bg-white focus:border-brand'

export function OfferCard({ offer, busy, onBook }: Props) {
  const [serviceId, setServiceId] = useState(offer.services[0]?.serviceDocId || '')
  const svc = offer.services.find((s) => s.serviceDocId === serviceId) || offer.services[0]
  if (!svc) return null
  return (
    <div className={rowCls} data-offer={`${offer.mode}:${offer.employeeDocId}`}>
      <div className="flex items-center justify-between gap-2 md:contents">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-bold text-ink truncate">{offer.employeeName}</span>
          {offer.tier === 'junior' && <span className={juniorBadgeCls}>junior</span>}
        </span>
        <span className="text-[12.5px] font-semibold text-ink-muted whitespace-nowrap" data-time>
          {svc.startTime}–{svc.endTime}
        </span>
      </div>
      <div className="relative min-w-0">
        <select className={selectCls} value={svc.serviceDocId} onChange={(e) => setServiceId(e.target.value)} aria-label="Услуга">
          {offer.services.map((s) => (
            <option key={s.serviceDocId} value={s.serviceDocId}>
              {s.title} · {s.durationMin} мин
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-[11px] top-[11px] pointer-events-none text-ink-muted" />
      </div>
      <div className="flex items-center justify-between gap-2 md:contents">
        <span className="flex items-center gap-2 md:contents">
          <span className="flex items-baseline justify-end gap-1.5 whitespace-nowrap" data-price>
            <s className="text-[12px] font-semibold text-ink-muted">{kcNum(svc.price)}</s>
            <b className="text-[14px] font-extrabold text-ink">{kc(svc.discountedPrice)}</b>
          </span>
          <span className="text-[11.5px] font-extrabold text-pos bg-pos-bg rounded-full px-2 py-1 text-center whitespace-nowrap" data-commission>
            +{kc(svc.commissionKc)}
          </span>
        </span>
        <button type="button" className={`${btnPinkCls} !py-1.5 !text-[12.5px]`} disabled={busy} onClick={() => onBook(offer, svc)}>
          Dozapsat
        </button>
      </div>
    </div>
  )
}
