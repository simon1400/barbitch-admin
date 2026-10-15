// «Úkoly» администраторов (s262): задачи, которые им ставят владелец и управляющая — свои
// (на её карточку) и общие («všem administrátorkám», закрывает любая, кто сделала).
// Сами администраторы задач не ставят: пишут průběh и комментарии, отмечают «Hotovo» (уходит
// постановщику к převzetí) и снимают его, пока не принято; вложения — фото/PDF.
// `focus` (`?task=<id>` — push, карточка в кабинете) — задача раскрыта и прокручена к себе; закрытой среди
// активных нет — список сам переходит на «Uzavřené». Поздний ответ прежнего фильтра в экран не ложится.
// s263: страница `/ukoly` стала вкладкой «Úkoly» модуля «Směna» (`/smena?tab=ukoly`) — здесь только
// список; `reloadKey` — перечитать после действия во вкладке «Směna», `onActiveCount` — счётчик вкладки.
// s265: задачи, которые она поставила коллеге, — отдельной группой «Zadala jsem kolegyni» (в счётчик
// вкладки не входят); на своих — «Předat kolegyni».
import { useCallback, useEffect, useRef, useState } from 'react'

import { cardPadCls, hintCls, pillCls, toolbarCardCls } from '../../ui/kit'
import { RefreshButton } from '../../components/RefreshButton'
import { Notice } from '../vykaz/components/ReportParts'
import { TaskCard } from '../vykaz/components/TaskParts'
import { fetchTasks, isPeerTaskByMe, type Task, type TaskScope, type TasksList } from '../vykaz/fetch/tasks'

export function UkolyList({
  focus,
  reloadKey = 0,
  onActiveCount,
  onChanged,
}: {
  focus: string | null
  reloadKey?: number
  onActiveCount?: (n: number) => void
  onChanged?: () => void
}) {
  const [scope, setScope] = useState<TaskScope>('active')
  const [data, setData] = useState<TasksList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(focus)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const focusRef = useRef(focus)
  const seq = useRef(0)

  const load = useCallback(async (sc: TaskScope, keepError = false) => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await fetchTasks(sc)
      if (my !== seq.current) return
      setData(res)
      setUpdatedAt(Date.now())
      if (!keepError) setError(null)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(scope)
  }, [load, scope, reloadKey])

  useEffect(() => {
    if (data?.scope === 'active') onActiveCount?.(data.tasks.filter((t) => !isPeerTaskByMe(t)).length)
  }, [data, onActiveCount])

  useEffect(() => {
    const f = focusRef.current
    if (!f || !data || data.scope !== scope) return
    if (data.tasks.some((t) => t.documentId === f)) {
      focusRef.current = null
      setTimeout(() => document.querySelector(`[data-task="${f}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 0)
    } else if (scope === 'active') setScope('closed')
    else focusRef.current = null
  }, [data, scope])

  const replace = (t: Task) => setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.documentId === t.documentId ? t : x)) } : d))

  const tasks = data?.tasks ?? []
  const waiting = scope === 'active' ? tasks.filter((t) => t.status === 'done').length : 0
  const mine = tasks.filter((t) => !isPeerTaskByMe(t))
  const given = tasks.filter(isPeerTaskByMe)
  // кому передать — работающие администраторки без меня
  const colleagues = (data?.admins ?? []).filter((a) => a.documentId !== data?.me)

  const card = (t: Task) => (
    <TaskCard
      key={t.documentId}
      task={t}
      role="administrator"
      open={open === t.documentId}
      onToggle={() => setOpen(open === t.documentId ? null : t.documentId)}
      onSaved={(nt) => {
        replace(nt)
        onChanged?.()
        // передала — задача ушла от неё; статус сменился — перечитать
        if (nt.status !== t.status || nt.personal !== t.personal) void load(scope)
      }}
      onConflict={() => void load(scope, true)}
      admins={colleagues}
    />
  )

  return (
    <div data-testid="ukoly-page">
      <div className={toolbarCardCls}>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtr úkolů">
          {(
            [
              ['active', 'Aktivní'],
              ['closed', 'Uzavřené'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={pillCls(scope === key)} aria-pressed={scope === key} onClick={() => setScope(key)}>
              {label}
            </button>
          ))}
        </div>
        <RefreshButton onClick={() => void load(scope)} loading={loading} updatedAt={updatedAt} lang="cs" />
      </div>

      <Notice error={error} ok={null} />

      {data && waiting > 0 && <div className={`${hintCls} mb-3`}>Čeká na převzetí: {waiting}.</div>}

      {!data ? (
        <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">{loading ? 'Načítání…' : ''}</div>
      ) : tasks.length === 0 ? (
        <div className={`${cardPadCls} ${hintCls}`} data-testid="ukoly-empty">
          {scope === 'active' ? 'Žádné úkoly v práci.' : 'Zatím žádné uzavřené úkoly.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5" data-testid="ukoly-list">
          {mine.map(card)}
          {given.length > 0 && (
            <>
              <h2 className="m-0 mt-2 text-[14px] font-extrabold text-ink-soft" data-testid="ukoly-given">
                Zadala jsem kolegyni · {given.length}
              </h2>
              {given.map(card)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
