// Карточка клиента дня: аватар, имя, телефон, статус-чип, его брони и варианты
// дозаписи, сгруппированные по режиму («před» — до визита, «hned po» — сразу после).
import { badgeBaseCls, badgeNeutralCls, badgePosCls, cardCls, cardTitleCls, headMicroCls } from '../../../ui/kit'
import { hhmmToMin, minToHHMM } from '../../../utils/date'
import type { UpsellClient, UpsellMode, UpsellOffer, UpsellService } from '../fetch/upsellApi'
import { MODE_LABEL, freeMastersLabel, initials } from '../labels'
import { CheckIcon, ModeArrow } from './icons'
import { OfferCard } from './OfferCard'

interface Props {
  client: UpsellClient
  busyKey: string | null
  onBook: (client: UpsellClient, offer: UpsellOffer, svc: UpsellService) => void
}

const MODES: UpsellMode[] = ['before', 'after']

const timeChipCls = 'font-extrabold text-ink rounded-md px-2 py-0.5'
const rebookTagCls = `${badgeBaseCls} text-brand-dark bg-brand-tint`
const statusChipCls = 'whitespace-nowrap rounded-full border px-2.5 py-1'

/** Конец последнего активного визита клиента («v salonu · do 11:50»). */
const lastActiveEnd = (client: UpsellClient): string | null => {
  let max = -1
  for (const b of client.bookings) {
    if (b.status !== 'active') continue
    const end = b.time.split('–')[1]
    if (!end) continue
    const m = hhmmToMin(end)
    if (m > max) max = m
  }
  return max < 0 ? null : minToHHMM(max)
}

/** Граница группы режима: «před» — до начала визита, «hned po» — с самого раннего окна. */
const modeEdge = (mode: UpsellMode, offers: UpsellOffer[]): string | null => {
  if (mode === 'before') {
    const end = offers[0]?.services[0]?.endTime
    return end ? `do ${end}` : null
  }
  const start = Math.min(...offers.map((o) => o.startMin))
  return Number.isFinite(start) ? `od ${minToHHMM(start)}` : null
}

export function ClientCard({ client, busyKey, onBook }: Props) {
  const groups = MODES.map((mode) => ({ mode, offers: client.offers.filter((o) => o.mode === mode) })).filter(
    (g) => g.offers.length > 0,
  )
  const end = client.inSalon ? lastActiveEnd(client) : null
  const rebooked = client.alreadyRebooked
  return (
    <div className={`${cardCls} px-5 pt-[18px] pb-3 mb-3`} data-client={client.clientDocId}>
      <div className="flex items-center gap-3">
        <div
          className={`w-[38px] h-[38px] rounded-full shrink-0 flex items-center justify-center text-[13px] font-extrabold ${
            rebooked ? 'bg-pos-bg text-pos' : 'bg-brand-tint text-brand-dark'
          }`}
          aria-hidden="true"
        >
          {rebooked ? <CheckIcon /> : initials(client.clientName)}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-grow">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className={cardTitleCls}>{client.clientName || 'Без имени'}</h3>
            {client.phone && (
              <a className="text-[12.5px] font-semibold text-ink-muted" href={`tel:${client.phone}`}>
                {client.phone}
              </a>
            )}
          </div>
          {client.bookings.map((b) => (
            <div
              key={b.documentId}
              className={`flex items-center gap-2 flex-wrap text-[12.5px] font-semibold text-ink-body ${
                b.status !== 'active' ? 'line-through opacity-60' : ''
              }`}
            >
              <span className={`${timeChipCls} ${b.isRebook ? 'bg-brand-tint' : 'bg-surface-input'}`}>{b.time}</span>
              <span>{b.employeeName}</span>
              <span className="text-ink-disabled">·</span>
              <span className="text-ink-muted">{b.services.join(' + ') || '—'}</span>
              {b.isRebook && <span className={rebookTagCls}>дозапись</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold">
          {rebooked && <span className={`${badgePosCls} ${statusChipCls} border-pos-line`}>уже есть дозапись</span>}
          {client.inSalon ? (
            <span className={`${badgePosCls} ${statusChipCls} border-pos-line`}>v salonu{end ? ` · do ${end}` : ''}</span>
          ) : (
            <span className={`${badgeNeutralCls} ${statusChipCls} border-line-btn !text-ink-body`}>
              přijde v {minToHHMM(client.firstStartMin)}
            </span>
          )}
        </div>
      </div>

      {groups.map(({ mode, offers }) => (
        <section key={mode} data-mode={mode}>
          <div className="flex items-center gap-2 mt-4 pb-1.5">
            <span
              className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${
                mode === 'before' ? 'bg-warn-bg text-warn' : 'bg-line-soft text-ink-body'
              }`}
            >
              <ModeArrow dir={mode} />
            </span>
            <span className={`${headMicroCls} text-ink-muted`}>{MODE_LABEL[mode]}</span>
            <span className="text-[12.5px] font-bold text-ink">{modeEdge(mode, offers)}</span>
            <span className="text-[12px] font-semibold text-ink-muted">· {freeMastersLabel(offers.length)}</span>
          </div>
          {offers.map((o) => (
            <OfferCard key={o.employeeDocId} offer={o} busy={busyKey !== null} onBook={(offer, svc) => onBook(client, offer, svc)} />
          ))}
        </section>
      ))}

      {groups.length === 0 && !rebooked && (
        <div className="mt-3 text-[12.5px] font-semibold text-ink-muted">Свободных окон рядом с визитом нет.</div>
      )}
    </div>
  )
}
