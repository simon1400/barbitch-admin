// Строка таблицы спящих. Перенесено из SleepingTab.tsx (этап 6) дословно.
import { memo } from 'react'
import { Cell } from '../../../../dashboard/components/Cell'
import { kcNum } from '../../../../../utils/money'
import { daysSinceIso, type SentInfo } from '../../fetch/emailCampaign'
import type { SleepingClient } from '../../fetch/sleepingClients'
import { fmtDate, fmtDateTime } from './format'

// Строка таблицы спящих. memo + стабильный onToggle: клик по одному чекбоксу
// перерисовывает ТОЛЬКО свою строку, а не весь список.
export const SleepingRow = memo(function SleepingRow({
  row: r,
  sent,
  checked,
  onToggle,
}: {
  row: SleepingClient
  sent: SentInfo | undefined
  checked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <tr className={`hover:bg-surface-hover transition-colors ${checked ? 'bg-pink-50/50' : ''}`}>
      <td className="p-4 border-b border-line-soft">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(r.customerId)}
          disabled={!r.email}
          className="w-4 h-4 accent-pink-600 cursor-pointer disabled:opacity-30"
          title={r.email ? r.email : 'Нет email'}
        />
      </td>
      <td className="p-4 border-b border-line-soft">
        <span className="block font-sans text-sm font-medium text-ink">{r.name}</span>
        {r.email && <span className="text-xs text-ink-faint">{r.email}</span>}
      </td>
      <Cell title={r.phone || '—'} />
      <Cell title={String(r.visits)} />
      <td className="p-4 border-b border-line-soft">
        <span className="block font-sans text-sm font-medium text-ink">
          {fmtDate(r.lastVisit)} <span className="text-xs text-ink-faint">({r.daysSince} дн.)</span>
        </span>
      </td>
      <Cell title={r.lastMaster || '—'} />
      <Cell title={`${kcNum(r.spent)} Kč`} className="text-brand" />
      <td className="p-4 border-b border-line-soft">
        {sent ? (
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold bg-info-bg text-info whitespace-nowrap"
            title={`Шаблон: ${sent.template}`}
          >
            {fmtDateTime(sent.lastSentAt)} ({daysSinceIso(sent.lastSentAt)} дн.)
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  )
})
