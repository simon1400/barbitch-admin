/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo } from 'react'
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { CommentPopover } from './CommentPopover'
import { hasComment } from './helpers'
import { upsellCommissionState, type UpsellCommissionState } from '../../../../lib/upsellCommission'
import { fmtTimePrague } from '../../../../utils/date'

// Plain-text comment (cash.comment, flow.coment) — not HTML, render inline.
const hasText = (raw: unknown) =>
  typeof raw === 'string' && raw.trim().length > 0

export const CashCard = memo(({ data }: { data: ShiftCheckResult['cash'] }) => (
  <CheckCard title="Pokladna (Cash)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-3">
        {data.items.map((item: any, i: number) => {
          const flow: any[] = Array.isArray(item.flow) ? item.flow : []
          return (
            <div key={i} className="rounded-lg border border-line-soft bg-surface-tile p-2">
              <div className="text-sm text-ink-body flex justify-between items-center">
                <span className="font-medium">{item.name || item.personal?.name || '—'}</span>
                <span className="font-medium">
                  {item.sum} Kč (zisk: {item.profit} Kč)
                </span>
              </div>
              {hasText(item.comment) && (
                <p className="mt-1 text-xs text-ink-soft italic">{item.comment}</p>
              )}
              {flow.length > 0 && (
                <div className="mt-2 border-t border-line pt-2 space-y-1">
                  <p className="text-xs font-medium text-ink-soft">Pohyb peněz</p>
                  {flow.map((f: any, fi: number) => (
                    <div key={fi} className="text-sm text-ink-muted flex justify-between gap-3">
                      <span className="break-words">{hasText(f.coment) ? f.coment : '—'}</span>
                      <span className="font-medium whitespace-nowrap">{f.sum} Kč</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold text-ink border-t border-line pt-1">
                    <span>Celkem</span>
                    <span>
                      {flow.reduce((s: number, f: any) => s + (Number(f.sum) || 0), 0)} Kč
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )}
  </CheckCard>
))
CashCard.displayName = 'CashCard'

export const WorkTimeCard = memo(({ data }: { data: ShiftCheckResult['workTime'] }) => (
  <CheckCard title="Pracovní doba (Work Time)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-1">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-ink-muted flex justify-between">
            <span className="inline-flex items-center">
              {item.personal?.name || '—'}
              {hasComment(item.comment) && <CommentPopover html={item.comment} />}
            </span>
            <span className="font-medium">
              {item.startTime} – {item.endTime} ({item.sum}h)
            </span>
          </div>
        ))}
      </div>
    )}
  </CheckCard>
))
WorkTimeCard.displayName = 'WorkTimeCard'

export const PayrollCard = memo(({ data }: { data: ShiftCheckResult['payroll'] }) => (
  <CheckCard title="Výplaty (Payroll)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-1">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-ink-muted flex justify-between">
            <span>{item.personal?.name || '—'}</span>
            <span className="font-medium">{item.sum} Kč</span>
          </div>
        ))}
      </div>
    )}
  </CheckCard>
))
PayrollCard.displayName = 'PayrollCard'

// Комиссии администраторов за дозаписи (s197). Публикуются вместе со сменой
// только у закрытых визитов; остальное — видно здесь и не блокирует закрытие.
const UPSELL_STATE: Record<UpsellCommissionState, { text: string; cls: string }> = {
  ready: { text: 'k potvrzení', cls: 'bg-pos-bg text-pos' },
  // text-warn (#b0862a) на warn-bg не проходит по контрасту для 12px → темнее локально
  visit_open: { text: 'návštěva neuzavřena', cls: 'bg-warn-bg text-[#7a5c14]' },
  visit_cancelled: { text: 'návštěva zrušena', cls: 'bg-neg-bg text-neg' },
  no_booking: { text: 'rezervace smazána', cls: 'bg-neg-bg text-neg' },
}

const bookingServices = (raw: unknown): string => {
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((s: any) => s?.title).filter(Boolean).join(' + ')
}

// Тот же контракт, что у чипа в ServiceProvidedCard и push-уведомлений:
// CalendarPage читает ?date=&highlight=<bookingDocId>, открывает день и мигает карточкой.
// 🟥 Дата — ИМЕННО брони (booking.date); дата смены только как запасной вариант.
const upsellCalendarLink = (bookingDocId: string, date: string) =>
  `/calendar?date=${encodeURIComponent(date)}&highlight=${encodeURIComponent(bookingDocId)}`

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const CalendarOpenIcon = () => (
  <svg width="18" height="18" {...svgProps}>
    <path d="M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
    <path d="M15 21l6-6" />
    <path d="M16 15h5v5" />
  </svg>
)

const ClientIcon = () => (
  <svg width="14" height="14" className="shrink-0" {...svgProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

const MasterIcon = () => (
  <svg width="14" height="14" className="shrink-0" {...svgProps}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M8.1 8.1 20 20" />
    <path d="M8.1 15.9 20 4" />
  </svg>
)

const UPSELL_GRID =
  'md:grid md:grid-cols-[56px_minmax(0,1fr)_minmax(0,190px)_72px_minmax(0,164px)_44px] md:gap-x-5 md:items-center'

const linkBoxCls = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]'

const UpsellCalendarLink = ({ item, shiftDate }: { item: any; shiftDate: string }) => {
  const docId = item.booking?.documentId
  if (!docId) {
    return (
      <span title="Rezervace už neexistuje" className={`${linkBoxCls} border border-dashed border-line-btn text-ink-disabled`}>
        <CalendarOpenIcon />
      </span>
    )
  }
  return (
    <a
      href={upsellCalendarLink(docId, item.booking?.date || shiftDate)}
      target="_blank"
      rel="noopener noreferrer"
      title="Otevřít v kalendáři"
      aria-label="Otevřít dozápis v kalendáři"
      className={`${linkBoxCls} border border-line-btn bg-white text-ink-muted transition-colors hover:border-line-btn-hover hover:text-ink`}
    >
      <CalendarOpenIcon />
    </a>
  )
}

export const UpsellCommissionCard = memo(
  ({ data, shiftDate }: { data: ShiftCheckResult['upsell']; shiftDate: string }) => {
    const items = useMemo(
      () =>
        [...(data.items as any[])].sort((a, z) =>
          (a.booking?.startsAt || '9').localeCompare(z.booking?.startsAt || '9'),
        ),
      [data.items],
    )
    const ready = items.filter((i) => upsellCommissionState(i) === 'ready')
    const readySum = ready.reduce((s, i) => s + (Number(i.sum) || 0), 0)

    return (
      <CheckCard title="Dozápisy administrátorů" found={data.found} count={data.count}>
        {items.length === 0 ? (
          <p className="m-0 text-sm text-ink-soft">Žádné dozápisy</p>
        ) : (
          <div className="mt-2">
            <div className={`hidden ${UPSELL_GRID} pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted`}>
              <span>Čas</span>
              <span>Služba · klient → mistr</span>
              <span>Dozapsal(a)</span>
              <span className="text-right">Provize</span>
              <span>Stav</span>
              <span />
            </div>
            {items.map((item: any, i: number) => {
              const stateKey = upsellCommissionState(item)
              const state = UPSELL_STATE[stateKey]
              const publishable = stateKey === 'ready'
              const b = item.booking
              return (
                <div
                  key={item.documentId || i}
                  data-upsell={item.documentId}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft py-3 ${UPSELL_GRID}`}
                >
                  <span className="order-1 w-full text-xs font-semibold tabular-nums text-ink-muted md:order-none md:w-auto md:text-sm md:text-ink">
                    {b?.startsAt ? fmtTimePrague(b.startsAt) : '—'}
                  </span>
                  <div className="order-2 min-w-0 flex-1 basis-0 md:order-none">
                    <div className="text-[15px] font-semibold leading-snug text-ink md:truncate">
                      {bookingServices(b?.services) || '—'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-ink-muted">
                      <ClientIcon />
                      <span>{b?.clientNameRaw || '—'}</span>
                      {b?.employeeNameRaw && (
                        <>
                          <span className="text-ink-disabled">→</span>
                          <MasterIcon />
                          <span>{b.employeeNameRaw}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="order-4 min-w-0 flex-1 truncate text-[13px] text-ink-muted md:order-none md:text-sm md:text-ink-body">
                    {item.personal?.name || '—'}
                  </span>
                  <span
                    className={`order-5 text-sm font-semibold tabular-nums md:order-none md:text-right md:text-[15px] ${
                      publishable ? 'text-ink' : 'text-ink-faint'
                    }`}
                  >
                    {item.sum} Kč
                  </span>
                  <span className={`order-6 justify-self-start whitespace-nowrap rounded-md px-[9px] py-[5px] text-xs font-bold md:order-none ${state.cls}`}>
                    {state.text}
                  </span>
                  <span className="order-3 md:order-none">
                    <UpsellCalendarLink item={item} shiftDate={shiftDate} />
                  </span>
                  {/* мобильный перенос: админ / сумма / статус — отдельной строкой под услугой */}
                  <span aria-hidden className="order-3 h-0 w-full md:hidden" />
                </div>
              )
            })}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-[13px] text-ink-muted">
              <span>
                {ready.length} z {items.length} se potvrdí při uzavření směny
                {ready.length < items.length ? ' · ostatní směnu neblokují' : ''}
              </span>
              <span>
                Publikuje se <strong className="text-[15px] font-bold text-ink">{readySum} Kč</strong>
              </span>
            </div>
          </div>
        )}
      </CheckCard>
    )
  },
)
UpsellCommissionCard.displayName = 'UpsellCommissionCard'
