/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'
import { sortByClientName } from './helpers'

export const NoonaEventsCard = ({ data }: { data: ShiftCheckResult['noona'] }) => (
  <CheckCard title="Noona události" found={data.found} count={data.count}>
    {data.found && data.events.length > 0 && (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2 pr-3">Klient</th>
              <th className="pb-2 pr-3">Služba</th>
              <th className="pb-2 pr-3">Čas</th>
              <th className="pb-2">Cena</th>
            </tr>
          </thead>
          <tbody>
            {sortByClientName(data.events, 'customer_name').map((event: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-3">{event.customer_name || '—'}</td>
                <td className="py-2 pr-3">{event.event_types?.[0]?.title || '—'}</td>
                <td className="py-2 pr-3">
                  {event.starts_at
                    ? new Date(event.starts_at).toLocaleTimeString('cs-CZ', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="py-2">
                  {event.event_types?.[0]?.price?.amount != null
                    ? `${event.event_types[0].price.amount} Kč`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold text-gray-800">
              <td className="pt-2 pr-3" colSpan={2}>Celkem</td>
              <td className="pt-2 pr-3"></td>
              <td className="pt-2">
                {data.events.reduce(
                  (sum: number, event: any) =>
                    sum + (event.event_types?.[0]?.price?.amount ?? 0),
                  0,
                )} Kč
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </CheckCard>
)
