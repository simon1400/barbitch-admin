/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShiftCheckResult } from '../../fetch/shiftClose'
import { CheckCard } from './CheckCard'

export const CashCard = ({ data }: { data: ShiftCheckResult['cash'] }) => (
  <CheckCard title="Pokladna (Cash)" found={data.found} count={data.count}>
    {data.found && data.items.length > 0 && (
      <div className="mt-2 space-y-1">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-gray-600 flex justify-between">
            <span>{item.name || item.personal?.name || '—'}</span>
            <span className="font-medium">
              {item.sum} Kč (zisk: {item.profit} Kč)
            </span>
          </div>
        ))}
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
            <span>{item.personal?.name || '—'}</span>
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
