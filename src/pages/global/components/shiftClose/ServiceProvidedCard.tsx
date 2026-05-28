/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import {
  FLAG_META,
  VERIFY_FLAGS,
  getFlagDelta,
  getItemFlags,
  type ShiftCheckResult,
  type VerifyFlag,
} from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { sortByClientName } from './helpers'

const hasComment = (raw: unknown) => {
  if (!raw || typeof raw !== 'string') return false
  return raw.replace(/<[^>]*>/g, '').trim().length > 0
}

const CommentPopover = ({ html }: { html: string }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Zobrazit komentář"
        aria-label="Zobrazit komentář"
        className="text-yellow-500 hover:text-yellow-600 transition-colors leading-none"
      >
        💬
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute z-20 left-0 top-full mt-1 w-72 max-w-[80vw] rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-left text-sm text-gray-700 font-normal whitespace-normal break-words"
        >
          <span
            className="block prose prose-sm max-w-none [&_*]:m-0 [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </span>
      )}
    </span>
  )
}

const formatDelta = (delta: number | null): string => {
  if (delta === null || !Number.isFinite(delta)) return ''
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${Math.round(Math.abs(delta))} Kč`
}

const FlagChip = ({ flag, item }: { flag: VerifyFlag; item: any }) => {
  const meta = FLAG_META[flag]
  const delta = getFlagDelta(item, flag)
  const deltaStr = formatDelta(delta)
  const title = deltaStr ? `${meta.label} (${deltaStr})` : meta.label
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded text-xs font-medium ${meta.chipCls}`}
    >
      {meta.emoji}
    </span>
  )
}

export const ServiceProvidedCard = ({ data }: { data: ShiftCheckResult['serviceProvided'] }) => {
  const visibleCounters = VERIFY_FLAGS.filter((f) => data.flagCounts[f] > 0)

  return (
    <CheckCard
      title="Provedené služby (Service Provided)"
      found={data.found}
      count={data.count}
    >
      <div className="flex flex-wrap gap-2 mt-1">
        {visibleCounters.length === 0 && data.unverified === 0 && (
          <span className="text-sm text-gray-500">Žádné záznamy</span>
        )}
        {visibleCounters.map((f) => {
          const meta = FLAG_META[f]
          return (
            <span
              key={f}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.chipCls}`}
            >
              <span className={`w-2 h-2 rounded-full ${meta.dotCls}`} />
              {meta.label}: {data.flagCounts[f]}
            </span>
          )
        })}
        {data.unverified > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Neověřeno: {data.unverified}
          </span>
        )}
      </div>
      {data.items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-3">Klient</th>
                <th className="pb-2 pr-3">Mistr</th>
                <th className="pb-2 pr-3">Celkem</th>
                <th className="pb-2 pr-3">Tip</th>
                <th className="pb-2 pr-3">Hotově</th>
                <th className="pb-2">Verify</th>
              </tr>
            </thead>
            <tbody>
              {sortByClientName(data.items, 'clientName').map((item: any, i: number) => {
                const flags = getItemFlags(item)
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center">
                        {item.clientName}
                        {hasComment(item.comment) && <CommentPopover html={item.comment} />}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{item.personal?.name || '—'}</td>
                    <td className="py-2 pr-3">
                      {(Number(item.salonSalaries) || 0) + (Number(item.staffSalaries) || 0)} Kč
                    </td>
                    <td className="py-2 pr-3">{item.tip ? `${item.tip} Kč` : '—'}</td>
                    <td className="py-2 pr-3">{item.cash ? 'Ano' : 'Ne'}</td>
                    <td className="py-2">
                      {flags.length === 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          N/A
                        </span>
                      ) : (
                        <span className="inline-flex flex-wrap gap-1">
                          {flags.map((f) => <FlagChip key={f} flag={f} item={item} />)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-800">
                <td className="pt-2 pr-3" colSpan={2}>Celkem</td>
                <td className="pt-2 pr-3">
                  {data.items.reduce(
                    (sum: number, item: any) =>
                      sum + (Number(item.salonSalaries) || 0) + (Number(item.staffSalaries) || 0),
                    0,
                  )} Kč
                </td>
                <td className="pt-2 pr-3">
                  {data.items.reduce((sum: number, item: any) => sum + (Number(item.tip) || 0), 0) || '—'}
                  {data.items.some((i: any) => Number(i.tip) > 0) ? ' Kč' : ''}
                </td>
                <td className="pt-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </CheckCard>
  )
}
