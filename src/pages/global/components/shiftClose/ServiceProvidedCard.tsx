/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  FLAG_META,
  VERIFY_FLAGS,
  getFlagDelta,
  getItemFlags,
  type ShiftCheckResult,
  type VerifyFlag,
} from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { CommentPopover, hasComment } from './CommentPopover'
import {
  buildOfferMatches,
  sortByClientName,
  type OfferMatch,
  type OfferMatchStatus,
} from './helpers'

const STRAPI_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:1337'

const strapiLink = (documentId: string) =>
  `${STRAPI_URL}/admin/content-manager/collection-types/api::service-provided.service-provided/${documentId}?status=draft`

// Header icon for the "offer vs calendar service" comparison column.
const CompareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </svg>
)

// Header icon for the voucher column.
const TicketIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 11v2" />
    <path d="M13 17v2" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)

// Цены хранятся строками; junior-цены (−20%) могут быть с запятой как разделителем
// (напр. "237,6"). Number("237,6") = NaN → раньше показывало 0. Нормализуем запятую.
const toNum = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

const formatDelta = (delta: number | null): string => {
  if (delta === null || !Number.isFinite(delta)) return ''
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${Math.round(Math.abs(delta))} Kč`
}

const OFFER_MATCH_META: Record<OfferMatchStatus, { symbol: string; chipCls: string }> = {
  match: { symbol: '✓', chipCls: 'bg-green-100 text-green-800' },
  mismatch: { symbol: '✗', chipCls: 'bg-red-100 text-red-800' },
  missing: { symbol: '?', chipCls: 'bg-gray-100 text-gray-600' },
  'no-offer': { symbol: '—', chipCls: 'bg-amber-100 text-amber-800' },
}

const offerMatchTitle = (m: OfferMatch): string => {
  switch (m.status) {
    case 'match': return `Shoduje se s kalendářem: ${m.calendarTitle}`
    case 'mismatch': return `Strapi: ${m.strapiTitle}\nKalendář: ${m.calendarTitle}`
    case 'missing': return `Strapi: ${m.strapiTitle}\nKlient nemá rezervaci v kalendáři`
    default: return 'Služba (offer) není připojena'
  }
}

const OfferMatchChip = ({ match }: { match: OfferMatch | undefined }) => {
  if (!match) return <span className="text-gray-400">—</span>
  const meta = OFFER_MATCH_META[match.status]
  return (
    <span
      title={offerMatchTitle(match)}
      className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded text-xs font-bold cursor-default ${meta.chipCls}`}
    >
      {meta.symbol}
    </span>
  )
}

// Voucher connected to a service (oneToOne relation, comes via populate=*).
// Icon-only chip — the voucher code (+ name / sum) shows in the tooltip on hover.
const VoucherChip = ({ voucher }: { voucher: any }) => {
  if (!voucher || (voucher.documentId == null && voucher.id == null)) {
    return <span className="text-gray-400">—</span>
  }
  const title = [
    voucher.name,
    voucher.idVoucher ? `#${voucher.idVoucher}` : null,
    voucher.sum != null ? `${voucher.sum} Kč` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center w-7 h-6 rounded text-sm bg-pink-100 text-pink-800 cursor-default"
    >
      🎟
    </span>
  )
}

const hasVoucher = (item: any): boolean =>
  item?.voucher != null && (item.voucher.documentId != null || item.voucher.id != null)

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

export const ServiceProvidedCard = ({
  data,
  calendarBookings,
}: {
  data: ShiftCheckResult['serviceProvided']
  calendarBookings: any[]
}) => {
  const visibleCounters = VERIFY_FLAGS.filter((f) => data.flagCounts[f] > 0)
  const offerMatches = buildOfferMatches(data.items, calendarBookings)
  const mismatchCount = [...offerMatches.values()].filter((m) => m.status === 'mismatch').length
  const voucherCount = data.items.filter((i: any) => hasVoucher(i)).length

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
        {mismatchCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Služba se liší od kalendáře: {mismatchCount}
          </span>
        )}
        {voucherCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            Voucher: {voucherCount}
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
                <th className="pb-2 pr-3" title="Služba (offer) vs kalendář">
                  <span className="inline-flex items-center text-gray-500">
                    <CompareIcon />
                  </span>
                </th>
                <th className="pb-2 pr-3">All</th>
                <th className="pb-2 pr-3">Tip</th>
                <th className="pb-2 pr-3">Cash</th>
                <th className="pb-2 pr-3" title="Voucher">
                  <span className="inline-flex items-center text-gray-500">
                    <TicketIcon />
                  </span>
                </th>
                <th className="pb-2 pr-3">Ver</th>
                <th className="pb-2"></th>
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
                      <OfferMatchChip match={offerMatches.get(item)} />
                    </td>
                    <td className="py-2 pr-3">
                      {Number((toNum(item.salonSalaries) + toNum(item.staffSalaries)).toFixed(2))} Kč
                    </td>
                    <td className="py-2 pr-3">{item.tip ? `${item.tip} Kč` : '—'}</td>
                    <td className="py-2 pr-3">{item.cash ? 'Ano' : 'Ne'}</td>
                    <td className="py-2 pr-3">
                      <VoucherChip voucher={item.voucher} />
                    </td>
                    <td className="py-2 pr-3">
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
                    <td className="py-2">
                      {item.documentId && (
                        <a
                          href={strapiLink(item.documentId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Otevřít ve Strapi"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors"
                        >
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-800">
                <td className="pt-2 pr-3" colSpan={3}>Celkem</td>
                <td className="pt-2 pr-3">
                  {Number(
                    data.items
                      .reduce(
                        (sum: number, item: any) =>
                          sum + toNum(item.salonSalaries) + toNum(item.staffSalaries),
                        0,
                      )
                      .toFixed(2),
                  )} Kč
                </td>
                <td className="pt-2 pr-3">
                  {data.items.reduce((sum: number, item: any) => sum + toNum(item.tip), 0) || '—'}
                  {data.items.some((i: any) => toNum(i.tip) > 0) ? ' Kč' : ''}
                </td>
                <td className="pt-2" colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </CheckCard>
  )
}
