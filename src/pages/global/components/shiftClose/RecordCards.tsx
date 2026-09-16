/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react'
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { CommentPopover } from './CommentPopover'
import { hasComment } from './helpers'
import { upsellCommissionState, type UpsellCommissionState } from '../../../../lib/upsellCommission'

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
  visit_open: { text: 'návštěva neuzavřena', cls: 'bg-warn-bg text-warn' },
  visit_cancelled: { text: 'návštěva zrušena', cls: 'bg-neg-bg text-neg' },
  no_booking: { text: 'rezervace smazána', cls: 'bg-neg-bg text-neg' },
}

const bookingServices = (raw: unknown): string => {
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((s: any) => s?.title).filter(Boolean).join(' + ')
}

export const UpsellCommissionCard = memo(({ data }: { data: ShiftCheckResult['upsell'] }) => (
  <CheckCard title="Dozápisy administrátorů" found={data.found} count={data.count}>
    {data.items.length === 0 ? (
      <p className="m-0 text-sm text-ink-soft">Žádné dozápisy</p>
    ) : (
      <div className="mt-2 space-y-1.5">
        {data.items.map((item: any, i: number) => {
          const state = UPSELL_STATE[upsellCommissionState(item)]
          return (
            <div key={item.documentId || i} className="text-sm text-ink-muted flex justify-between gap-3" data-upsell={item.documentId}>
              <span className="break-words">
                <span className="font-medium text-ink">{item.personal?.name || '—'}</span>
                {' · '}
                {item.booking?.clientNameRaw || '—'}
                {' · '}
                {bookingServices(item.booking?.services) || '—'}
                {item.booking?.employeeNameRaw ? ` u ${item.booking.employeeNameRaw}` : ''}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-medium">{item.sum} Kč</span>
                <span className={`rounded-md px-[7px] py-0.5 text-[11px] font-bold ${state.cls}`}>{state.text}</span>
              </span>
            </div>
          )
        })}
      </div>
    )}
  </CheckCard>
))
UpsellCommissionCard.displayName = 'UpsellCommissionCard'
