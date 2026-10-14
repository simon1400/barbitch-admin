// Плитка «Зарезервировано за день» на главной владельца (s258, просьба владельца): сколько броней
// СОЗДАНО в выбранный день салона (Прага), стрелки ‹ › листают дни, сравнение с предыдущим днём
// (▲ больше / ▼ меньше / = столько же). Не зависит от месяца в тулбаре. Считает тот же
// `countBookingsCreatedBetween`, что «Зарезерв. за месяц»; сегодняшний день перечитывается по
// кнопке обновления страницы (`reloadKey`), прошедшие дни кэшируются в памяти плитки.
import { useEffect, useRef, useState } from 'react'

import { countBookingsCreatedBetween } from '../../../lib/mirror'
import { headMicroCls, tileGeomCls, tileSubCls, tileValueBaseCls } from '../../../ui/kit'
import { addDaysYmd, dowOfYmd, DOW_RU_SHORT, fmtCsDate, pragueDayStartIso, todayYmd } from '../../../utils/date'

/** Подпись дня: «Сегодня», «Вчера», иначе «Пн 12.10». */
const dayLabel = (day: string, today: string): string => {
  if (day === today) return 'Сегодня'
  if (day === addDaysYmd(today, -1)) return 'Вчера'
  return `${DOW_RU_SHORT[dowOfYmd(day)]} ${fmtCsDate(day).slice(0, 5)}`
}

/** Брони, созданные за пражский день: [полночь, следующая полночь). */
const countForDay = (day: string): Promise<number> => {
  const from = pragueDayStartIso(day)
  const to = new Date(Date.parse(pragueDayStartIso(addDaysYmd(day, 1))) - 1).toISOString()
  return countBookingsCreatedBetween(from, to).then((n) => Number(n) || 0)
}

const arrowCls =
  'w-7 h-7 rounded-md border border-line-btn bg-white text-ink-muted text-[15px] leading-none inline-flex items-center justify-center hover:text-ink hover:border-line-btn-hover disabled:opacity-40 disabled:cursor-default'

export const DayBookingsTile = ({ reloadKey }: { reloadKey: number }) => {
  const [day, setDay] = useState(todayYmd)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState(false)
  const today = todayYmd()
  const prev = addDaysYmd(day, -1)
  const cache = useRef(counts)
  cache.current = counts

  // кнопка «обновить» на странице — сегодняшний (и вчерашний для сравнения) счёт заново
  useEffect(() => {
    if (!reloadKey) return
    const t = todayYmd()
    setCounts((c) => {
      const next = { ...c }
      delete next[t]
      delete next[addDaysYmd(t, -1)]
      return next
    })
  }, [reloadKey])

  useEffect(() => {
    let alive = true
    const need = [day, prev].filter((d) => !(d in cache.current))
    if (!need.length) return
    setError(false)
    Promise.all(need.map((d) => countForDay(d).then((n) => [d, n] as const)))
      .then((pairs) => {
        if (alive) setCounts((c) => ({ ...c, ...Object.fromEntries(pairs) }))
      })
      .catch(() => {
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [day, prev, counts])

  const value = counts[day]
  const before = counts[prev]
  const diff = value != null && before != null ? value - before : null
  const isToday = day === today

  return (
    <div className={`${tileGeomCls} w-full bg-surface-tile`} data-testid="day-bookings">
      <div className="flex items-center gap-1.5 mb-[5px]">
        <span className={`${headMicroCls} text-ink-soft min-w-0 flex-1 truncate`}>Зарезерв. за день</span>
        <button type="button" className={arrowCls} onClick={() => setDay(prev)} aria-label="Предыдущий день" data-day-prev>
          ‹
        </button>
        <button
          type="button"
          className={arrowCls}
          onClick={() => setDay(addDaysYmd(day, 1))}
          disabled={isToday}
          aria-label="Следующий день"
          data-day-next
        >
          ›
        </button>
      </div>
      <span className={`block ${tileValueBaseCls} text-ink`} data-day-value>
        {error ? '—' : value ?? '…'}
      </span>
      <span className={`block ${tileSubCls}`}>
        {isToday ? (
          <span>Сегодня</span>
        ) : (
          <button type="button" className="font-semibold text-brand-dark hover:underline" onClick={() => setDay(today)} title="Вернуться к сегодняшнему дню" data-day-label>
            {dayLabel(day, today)}
          </button>
        )}
        {error && <span className="text-neg"> · не удалось загрузить</span>}
        {!error && diff != null && (
          <span
            className={diff > 0 ? 'text-pos' : diff < 0 ? 'text-neg' : 'text-ink-faint'}
            title={`${dayLabel(prev, today)}: ${before}`}
            data-day-diff={diff}
          >
            {' · '}
            {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : '= столько же'} к {dayLabel(prev, today).toLowerCase()} ({before})
          </span>
        )}
      </span>
    </div>
  )
}
