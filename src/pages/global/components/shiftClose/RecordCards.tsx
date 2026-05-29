/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { CommentPopover, hasComment } from './CommentPopover'

// Plain-text comment (cash.comment, flow.coment) — not HTML, render inline.
const hasText = (raw: unknown) =>
  typeof raw === 'string' && raw.trim().length > 0

export const CashCard = ({ data }: { data: ShiftCheckResult['cash'] }) => (
  <CheckCard title="Pokladna (Cash)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-3">
        {data.items.map((item: any, i: number) => {
          const flow: any[] = Array.isArray(item.flow) ? item.flow : []
          return (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <div className="text-sm text-gray-700 flex justify-between items-center">
                <span className="font-medium">{item.name || item.personal?.name || '—'}</span>
                <span className="font-medium">
                  {item.sum} Kč (zisk: {item.profit} Kč)
                </span>
              </div>
              {hasText(item.comment) && (
                <p className="mt-1 text-xs text-gray-500 italic">{item.comment}</p>
              )}
              {flow.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500">Pohyb peněz</p>
                  {flow.map((f: any, fi: number) => (
                    <div key={fi} className="text-sm text-gray-600 flex justify-between gap-3">
                      <span className="break-words">{hasText(f.coment) ? f.coment : '—'}</span>
                      <span className="font-medium whitespace-nowrap">{f.sum} Kč</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-gray-200 pt-1">
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
)

export const WorkTimeCard = ({ data }: { data: ShiftCheckResult['workTime'] }) => (
  <CheckCard title="Pracovní doba (Work Time)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-1">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-gray-600 flex justify-between">
            <span className="inline-flex items-center">
              {item.personal?.name || '—'}
              {hasComment(item.comment) && <CommentPopover html={item.comment} />}
            </span>
            <span className="font-medium">
              {new Date(item.start).toLocaleTimeString('cs-CZ', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              –{' '}
              {new Date(item.end).toLocaleTimeString('cs-CZ', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              ({item.sum}h)
            </span>
          </div>
        ))}
      </div>
    )}
  </CheckCard>
)

export const PayrollCard = ({ data }: { data: ShiftCheckResult['payroll'] }) => (
  <CheckCard title="Výplaty (Payroll)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-1">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-gray-600 flex justify-between">
            <span>{item.personal?.name || '—'}</span>
            <span className="font-medium">{item.sum} Kč</span>
          </div>
        ))}
      </div>
    )}
  </CheckCard>
)
