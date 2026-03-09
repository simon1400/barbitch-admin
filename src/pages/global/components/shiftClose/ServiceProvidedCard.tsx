/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard, StatusBadge } from './CheckCard'
import { sortByClientName } from './helpers'

export const ServiceProvidedCard = ({ data }: { data: ShiftCheckResult['serviceProvided'] }) => (
  <CheckCard
    title="Provedené služby (Service Provided)"
    found={data.found}
    count={data.count}
  >
    <div className="flex gap-3 mt-1">
      <StatusBadge ok={data.verified > 0} label={`Ověřeno: ${data.verified}`} />
      <StatusBadge ok={data.unverified === 0} label={`Neověřeno: ${data.unverified}`} />
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
            {sortByClientName(data.items, 'clientName').map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-3">{item.clientName}</td>
                <td className="py-2 pr-3">{item.personal?.name || '—'}</td>
                <td className="py-2 pr-3">
                  {(Number(item.salonSalaries) || 0) + (Number(item.staffSalaries) || 0)} Kč
                </td>
                <td className="py-2 pr-3">{item.tip ? `${item.tip} Kč` : '—'}</td>
                <td className="py-2 pr-3">{item.cash ? 'Ano' : 'Ne'}</td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.verify && item.verify !== '' && item.verify !== 'false'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {item.verify || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
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
