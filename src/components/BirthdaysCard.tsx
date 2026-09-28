// Карточка «Дни рождения» (s221): сотрудники, у которых день рождения в ближайшие
// 30 дней; если таких нет — самый ближайший. Одна и та же на «Сегодня» и в кабинете администратора.
//   • BirthdaysCardView — только показ (данные приносит страница: «Сегодня» грузит
//     их вместе с остальными источниками и обновляет по своему таймеру);
//   • BirthdaysCard — сама загружает (кабинет администратора).
import { useEffect, useState } from 'react'

import { daysLeftLabel, fetchBirthdays, positionLabel, type Birthdays } from '../lib/birthdays'
import { errMsg } from '../lib/errMsg'
import { TodayCard, TodayRow } from '../pages/today/components/TodayCard'
import { badgeMutedCls, badgePosCls, badgeWarnCls, hintCls } from '../ui/kit'
import { DOW_RU_SHORT, dowOfYmd } from '../utils/date'

const smallCls = 'text-[11.5px] font-semibold text-ink-faint'

interface ViewProps {
  data: Birthdays | null
  loading: boolean
  error?: string | null
}

export function BirthdaysCardView({ data, loading, error }: ViewProps) {
  const items = data?.items ?? []
  const unknown = data?.unknown ?? []
  return (
    <TodayCard id="birthdays" title="Дни рождения" count={null} loading={loading} error={error}>
      {(items.length === 0 || data?.nearestOnly) && (
        <div className={hintCls} data-birthdays-empty>
          В ближайшие {data?.horizonDays ?? 30} дней дней рождения нет
          {items.length > 0 && ' — ближайший:'}
        </div>
      )}
      {items.map((b) => (
        <TodayRow
          key={b.docId}
          aside={
            <span
              className={`${b.daysLeft === 0 ? badgePosCls : b.daysLeft <= 7 ? badgeWarnCls : badgeMutedCls} whitespace-nowrap`}
            >
              {daysLeftLabel(b.daysLeft)}
            </span>
          }
        >
          <span data-birthday={b.name} data-days-left={b.daysLeft}>
            {b.daysLeft === 0 ? '🎉' : '🎂'} <b className="text-ink">{b.name}</b>
          </span>
          <div className={smallCls}>
            {DOW_RU_SHORT[dowOfYmd(b.next)]} {b.next.slice(8, 10)}.{b.next.slice(5, 7)}
            {positionLabel(b.position) && ` · ${positionLabel(b.position)}`}
          </div>
        </TodayRow>
      ))}
      {unknown.length > 0 && (
        <div className={hintCls} data-birthdays-unknown>
          Дата рождения не распознана (поправить в карточке сотрудника в Strapi): {unknown.join(', ')}
        </div>
      )}
    </TodayCard>
  )
}

export function BirthdaysCard() {
  const [data, setData] = useState<Birthdays | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchBirthdays()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errMsg(e, 'Ошибка загрузки')))
    return () => {
      alive = false
    }
  }, [])

  return <BirthdaysCardView data={data} loading={!data && !error} error={error} />
}
