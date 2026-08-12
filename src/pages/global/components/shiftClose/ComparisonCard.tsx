/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { StatSection } from '../StatSection'
import { bookingDocIdOf, getDiff } from './helpers'

export const ComparisonCard = ({ result }: { result: ShiftCheckResult }) => {
  const diff = getDiff(result)

  return (
    <StatSection title="Porovnání kalendář vs Strapi" id="comparison" defaultOpen>
      <div
        className={`rounded-xl p-5 border ${
          result.comparison.match
            ? 'bg-pos-bg border-pos-line'
            : 'bg-neg-bg border-neg-line'
        }`}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-ink-muted">Kalendář (aktivní)</p>
            <p className="text-2xl font-bold text-ink">{result.calendar.count}</p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Service Provided</p>
            <p className="text-2xl font-bold text-ink">
              {result.comparison.strapiCount}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Rozdíl</p>
            <p
              className={`text-2xl font-bold ${
                result.comparison.match ? 'text-pos' : 'text-neg'
              }`}
            >
              {result.comparison.match ? '0' : `±${result.comparison.difference}`}
            </p>
          </div>
        </div>

        {diff && (
          <div className="mt-4 space-y-3">
            {diff.strapiExtra.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-warn-bg p-4">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  Pouze v Strapi (chybí v kalendáři):
                </p>
                {diff.strapiExtra.map((item: any, i: number) => (
                  <div key={i} className="text-sm text-warn flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span className="font-medium">{item.clientName}</span>
                    <span className="text-orange-500">
                      — {item.personal?.name || '—'},{' '}
                      {(Number(item.salonSalaries) || 0) +
                        (Number(item.staffSalaries) || 0)}{' '}
                      Kč
                    </span>
                    {/* Запись из календаря, но её брони среди активных нет —
                        визит закрыли, а бронь потом отменили/удалили. */}
                    {bookingDocIdOf(item) && (
                      <span
                        title="Záznam je napojený na rezervaci, která už není aktivní (zrušená nebo smazaná)"
                        className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-200 text-orange-900"
                      >
                        rezervace zrušena
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {diff.calendarExtra.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-semibold text-purple-800 mb-2">
                  Pouze v kalendáři (chybí v Strapi):
                </p>
                {diff.calendarExtra.map((event: any, i: number) => (
                  <div key={i} className="text-sm text-purple-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="font-medium">{event.customer_name}</span>
                    <span className="text-purple-500">
                      — {event.event_types?.[0]?.title || '—'},{' '}
                      {event.starts_at
                        ? new Date(event.starts_at).toLocaleTimeString('cs-CZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </StatSection>
  )
}
