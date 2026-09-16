// Карточка клиента дня: контакты, его брони, варианты дозаписи.
import { badgeNegCls, badgePosCls, cardPadCls, cardTitleCls, hintCls, mutedCls } from '../../../ui/kit'
import type { UpsellClient, UpsellOffer, UpsellService } from '../fetch/upsellApi'
import { OfferCard } from './OfferCard'

interface Props {
  client: UpsellClient
  busyKey: string | null
  onBook: (client: UpsellClient, offer: UpsellOffer, svc: UpsellService) => void
}

export function ClientCard({ client, busyKey, onBook }: Props) {
  return (
    <div className={cardPadCls} data-client={client.clientDocId}>
      <div className="flex items-baseline gap-3 flex-wrap mb-2">
        <h3 className={cardTitleCls}>{client.clientName || 'Без имени'}</h3>
        {client.phone && (
          <a className={mutedCls} href={`tel:${client.phone}`}>
            {client.phone}
          </a>
        )}
        {client.alreadyRebooked && <span className={badgePosCls}>уже есть дозапись</span>}
      </div>
      <ul className="m-0 mb-2 p-0 list-none">
        {client.bookings.map((b) => (
          <li key={b.documentId} className={`${mutedCls} ${b.status !== 'active' ? 'line-through' : ''}`}>
            {b.time} · {b.employeeName} · {b.services.join(' + ') || '—'}
            {b.isRebook && <span className={`${badgeNegCls} ml-2`}>дозапись</span>}
          </li>
        ))}
      </ul>
      {client.offers.length > 0 ? (
        <div>
          {client.offers.map((o) => (
            <OfferCard
              key={`${o.mode}:${o.employeeDocId}`}
              offer={o}
              busy={busyKey !== null}
              onBook={(offer, svc) => onBook(client, offer, svc)}
            />
          ))}
        </div>
      ) : (
        !client.alreadyRebooked && <div className={hintCls}>Свободных окон рядом с визитом нет.</div>
      )}
    </div>
  )
}
