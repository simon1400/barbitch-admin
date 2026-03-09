/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { StatSection } from '../StatSection'
import { getDiff } from './helpers'

export const ComparisonCard = ({ result }: { result: ShiftCheckResult }) => {
  const diff = getDiff(result)

  return (
    <StatSection title="Porovnání Noona vs Strapi" id="comparison" defaultOpen>
      <div
        className={`rounded-xl p-5 border ${
          result.comparison.match
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">Noona (aktivní)</p>
            <p className="text-2xl font-bold text-gray-800">{result.noona.count}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Service Provided</p>
            <p className="text-2xl font-bold text-gray-800">
              {result.serviceProvided.count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Rozdíl</p>
            <p
              className={`text-2xl font-bold ${
                result.comparison.match ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {result.comparison.match ? '0' : `±${result.comparison.difference}`}
            </p>
          </div>
        </div>

        {diff && (
          <div className="mt-4 space-y-3">
            {diff.strapiExtra.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  Pouze v Strapi (chybí v Noona):
                </p>
                {diff.strapiExtra.map((item: any, i: number) => (
                  <div key={i} className="text-sm text-orange-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span className="font-medium">{item.clientName}</span>
                    <span className="text-orange-500">
                      — {item.personal?.name || '—'},{' '}
                      {(Number(item.salonSalaries) || 0) +
                        (Number(item.staffSalaries) || 0)}{' '}
                      Kč
                    </span>
                  </div>
                ))}
              </div>
            )}

            {diff.noonaExtra.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-semibold text-purple-800 mb-2">
                  Pouze v Noona (chybí v Strapi):
                </p>
                {diff.noonaExtra.map((event: any, i: number) => (
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
