// Один вариант дозаписи: мастер + режим (hned po / před) + выбор услуги + кнопка.
import { useState } from 'react'

import { badgeMutedCls, badgeNeutralCls, badgeWarnCls, bodyBoldCls, btnPinkCls, mutedCls, selectCls } from '../../../ui/kit'
import { kc } from '../../../utils/money'
import type { UpsellOffer, UpsellService } from '../fetch/upsellApi'
import { MODE_LABEL } from '../labels'

interface Props {
  offer: UpsellOffer
  busy: boolean
  onBook: (offer: UpsellOffer, svc: UpsellService) => void
}

export function OfferCard({ offer, busy, onBook }: Props) {
  const [serviceId, setServiceId] = useState(offer.services[0]?.serviceDocId || '')
  const svc = offer.services.find((s) => s.serviceDocId === serviceId) || offer.services[0]
  if (!svc) return null
  return (
    <div className="flex items-center gap-3 flex-wrap py-2.5 border-t border-line first:border-t-0">
      <span className={offer.mode === 'after' ? badgeNeutralCls : badgeWarnCls}>{MODE_LABEL[offer.mode]}</span>
      <span className={bodyBoldCls}>{offer.employeeName}</span>
      {offer.tier === 'junior' && <span className={badgeMutedCls}>junior</span>}
      <span className={mutedCls}>
        {svc.startTime}–{svc.endTime}
      </span>
      <select
        className={`${selectCls} min-w-0 max-w-full`}
        value={svc.serviceDocId}
        onChange={(e) => setServiceId(e.target.value)}
        aria-label="Услуга"
      >
        {offer.services.map((s) => (
          <option key={s.serviceDocId} value={s.serviceDocId}>
            {s.title} · {s.durationMin} мин
          </option>
        ))}
      </select>
      <span className="text-[13px] font-semibold text-ink-body whitespace-nowrap">
        <s className="text-ink-faint">{kc(svc.price)}</s> → <b>{kc(svc.discountedPrice)}</b> · vy +{kc(svc.commissionKc)}
      </span>
      <button type="button" className={`${btnPinkCls} ml-auto`} disabled={busy} onClick={() => onBook(offer, svc)}>
        Dozapsat
      </button>
    </div>
  )
}
