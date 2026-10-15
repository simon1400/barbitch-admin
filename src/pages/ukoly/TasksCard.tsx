// Карточка «Задачи» в кабинете администратора (s262): её и общие задачи в работе — просроченные
// и срочные первыми; строка ведёт на `/smena?tab=ukoly&task=` (s263: «Úkoly» — вкладка «Směna»).
// Сама загружает (как StockCard).
import { useEffect, useState } from 'react'

import { errMsg } from '../../lib/errMsg'
import { TodayCard, TodayRow } from '../today/components/TodayCard'
import { badgeMutedCls, badgeNegCls } from '../../ui/kit'
import { fetchTasksAttention, type TasksAttention } from '../vykaz/fetch/tasks'

const smallCls = 'text-[11.5px] font-semibold text-ink-faint'
const dm = (ymd: string | null): string => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '')

export function TasksCard() {
  const [data, setData] = useState<TasksAttention | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchTasksAttention()
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(errMsg(e, 'Не удалось загрузить задачи')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const rows = data?.next ?? []
  return (
    <TodayCard
      id="admin-my-tasks"
      title="Задачи"
      count={data ? data.overdue.length + data.urgent.length : null}
      loading={loading}
      error={error}
      okText={data && data.open > 0 ? `Просроченных нет · в работе ${data.open}` : 'Задач в работе нет'}
      link={{ to: '/smena?tab=ukoly', label: 'Úkoly' }}
    >
      {rows.map((t) => (
        <TodayRow
          key={t.documentId}
          to={`/smena?tab=ukoly&task=${encodeURIComponent(t.documentId)}`}
          aside={
            <span className={`${t.overdue || t.priority === 'urgent' ? badgeNegCls : badgeMutedCls} whitespace-nowrap`}>
              {t.overdue ? 'просрочено' : t.priority === 'urgent' ? 'срочно' : 'в работе'}
            </span>
          }
        >
          <b className="text-ink">{t.title}</b>
          <div className={smallCls}>
            {t.dueDate ? `срок ${dm(t.dueDate)}` : 'без срока'}
            {t.allAdmins ? ' · всем администраторам' : ''}
          </div>
        </TodayRow>
      ))}
    </TodayCard>
  )
}
