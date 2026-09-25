import { Link } from 'react-router-dom'
import { fmtCsDate } from '../../../../../utils/date'
import type { TimeOffConflict } from '../../fetch/timeOff'

// Брони мастера на дни отсутствия. Блок их НЕ отменяет — каждую надо перенести
// или отменить в календаре; ссылка открывает день с подсвеченной бронью.
export function ConflictList({ rows, title }: { rows: TimeOffConflict[]; title: string }) {
  if (!rows.length) return null
  return (
    <div role="alert" className="mt-3 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5" data-testid="timeoff-conflicts">
      <div className="text-[12.5px] font-bold text-warn">{title}</div>
      <ul className="m-0 mt-1.5 p-0 list-none space-y-1">
        {rows.map((c) => (
          <li key={c.documentId} className="text-[12px] font-normal text-ink-body">
            <Link
              to={`/calendar?date=${c.date}&highlight=${encodeURIComponent(c.documentId)}`}
              className="font-semibold text-brand-dark underline"
            >
              {fmtCsDate(c.date)}
              {c.time ? ` ${c.time}` : ''}
            </Link>
            {' · '}
            {c.client || 'без имени'}
            {c.internal ? ' (интерная)' : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
