// Карточка «Смена сегодня» в кабинете администратора (s263, §0а.3 плана — паттерн TasksCard):
// касса и свои часы за сегодня заполнены или нет, незакрытые визиты дня; ссылка → «Směna».
// Сама загружает. Без карточки сотрудника — понятная ошибка (как /smena).
// s265: непрочитанный «Vzkaz z minulé směny» — строкой сверху (и в счётчик).
import { useEffect, useState } from 'react'

import { errMsg } from '../../lib/errMsg'
import { todayYmd } from '../../utils/date'
import { TodayCard, TodayRow } from '../today/components/TodayCard'
import { badgeMutedCls, badgeNegCls, badgePosCls, badgeWarnCls } from '../../ui/kit'
import { fetchSmenaDay, fmtHours, fmtKc, type SmenaDay } from './fetch/smena'

export function SmenaCard() {
  const [data, setData] = useState<SmenaDay | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchSmenaDay(todayYmd())
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(errMsg(e, 'Не удалось загрузить смену')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const unread = (data?.handoverIn ?? []).filter((h) => !h.readAt)
  const missing = data ? Number(!data.cash) + Number(data.canWriteHours && !data.workTime) + Number((data.check.visitsOpen ?? 0) > 0) + Number(unread.length > 0) : null
  return (
    <TodayCard
      id="smena"
      title="Смена сегодня"
      count={missing}
      loading={loading}
      error={error}
      okText={data ? `Касса ${fmtKc(data.cash?.balance ?? 0)} · часы ${data.workTime ? fmtHours(data.workTime.hours) : '—'}` : undefined}
      link={{ to: '/smena', label: 'Směna' }}
    >
      {data && (
        <>
          {unread.length > 0 && (
            <TodayRow to="/smena" aside={<span className={badgeWarnCls}>{unread.length}</span>}>
              Сообщение с прошлой смены от {unread[0].fromName || 'коллеги'} — не прочитано
            </TodayRow>
          )}
          <TodayRow to="/smena" aside={<span className={data.cash ? badgePosCls : badgeNegCls}>{data.cash ? 'заполнена' : 'не заполнена'}</span>}>
            Касса{data.cash ? ` · ${fmtKc(data.cash.balance)}` : ''}
          </TodayRow>
          {data.canWriteHours && (
            <TodayRow to="/smena" aside={<span className={data.workTime ? badgePosCls : badgeNegCls}>{data.workTime ? 'записаны' : 'не записаны'}</span>}>
              Мои часы{data.workTime ? ` · ${data.workTime.startTime}–${data.workTime.endTime}` : ''}
            </TodayRow>
          )}
          {(data.check.visitsOpen ?? 0) > 0 && (
            <TodayRow to={`/calendar?date=${data.date}`} aside={<span className={badgeWarnCls}>{data.check.visitsOpen}</span>}>
              Незакрытые визиты
            </TodayRow>
          )}
          {/* s278: администраторки заполняют недельный график смен сами — модуль «Rozpis směn» */}
          <TodayRow to="/rozpis" aside={<span className={badgeMutedCls}>Rozpis směn</span>}>
            График смен администраторов на неделю
          </TodayRow>
        </>
      )}
    </TodayCard>
  )
}
