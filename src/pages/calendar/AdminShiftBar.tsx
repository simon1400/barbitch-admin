// Плашка «кто в этот день администратор» — видна ВСЕМ ролям (мастер/админ/владелец).
// Источник — плановый график из коллекции shift («Рабочие смены»), см. fetchAdminRoster.
// Дневной вид → дежурный показанной даты; недельный → чип на каждый день Пн–Вс.

import type { AdminRoster } from './fetch/calendarDay'
import type { Mode } from './utils'
import { mondayOf, shiftDate, todayStr } from './utils'

const WD_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const wdOf = (d: string): string => WD_SHORT[new Date(`${d}T12:00:00`).getDay()]

const barCls =
  'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-200 bg-white px-2 py-1.5 text-[13px] md:px-4'

const Label = () => (
  <span className="flex items-center gap-1 font-semibold text-gray-500">
    <span className="text-[13px] leading-none" aria-hidden>
      🧑‍💼
    </span>
    Administrátor:
  </span>
)

export const AdminShiftBar = ({
  roster,
  date,
  mode,
}: {
  roster: AdminRoster
  date: string
  mode: Mode
}) => {
  const today = todayStr()

  if (mode === 'day') {
    const name = roster[date]
    return (
      <div className={barCls}>
        <Label />
        {name ? (
          <span className="font-semibold text-gray-900">{name}</span>
        ) : (
          <span className="text-gray-400">rozpis není vyplněn</span>
        )}
      </div>
    )
  }

  // Недельный вид (в т.ч. календарь мастера): дежурный на каждый день недели
  const monday = mondayOf(date)
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
  return (
    <div className={barCls}>
      <Label />
      {days.map((d) => {
        const name = roster[d]
        return (
          <span
            key={d}
            className={`rounded px-1.5 py-0.5 ${d === today ? 'bg-pink-50 ring-1 ring-pink-200' : 'bg-gray-50'}`}
          >
            <span className="text-gray-400">{wdOf(d)}</span>{' '}
            <span className={name ? 'font-semibold text-gray-900' : 'text-gray-300'}>{name || '—'}</span>
          </span>
        )
      })}
    </div>
  )
}
