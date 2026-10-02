// «Úkoly od majitele» на странице /vykaz (s240): поручения управляющей — в работе и ждущие
// владельца, по кнопке — уже закрытые. Своя загрузка (сбой не трогает отчёт); `reloadKey`
// растёт после подачи отчёта с заметками по поручениям — их лента изменилась.
import { useCallback, useEffect, useRef, useState } from 'react'

import { cardPadCls, hintCls, pillCls } from '../../../ui/kit'
import { fetchTasks, type Task, type TaskScope, type TasksList } from '../fetch/tasks'
import { Notice } from './ReportParts'
import { TaskCard } from './TaskParts'

export default function MyTasks({ reloadKey }: { reloadKey: number }) {
  const [scope, setScope] = useState<TaskScope>('active')
  const [data, setData] = useState<TasksList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async (sc: TaskScope, keepError = false) => {
    const my = ++seq.current
    try {
      const res = await fetchTasks(sc)
      if (my !== seq.current) return
      setData(res)
      if (!keepError) setError(null)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load(scope)
  }, [load, scope, reloadKey])

  const replace = (t: Task) => setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.documentId === t.documentId ? t : x)) } : d))
  const tasks = data?.tasks ?? []

  return (
    <section className={`${cardPadCls} !mb-0 mt-3.5`} data-testid="my-tasks">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="m-0 text-[17px] font-extrabold text-ink">Úkoly od majitele</h2>
        <div className="flex gap-1.5" role="group" aria-label="Filtr úkolů">
          <button type="button" className={pillCls(scope === 'active')} aria-pressed={scope === 'active'} onClick={() => setScope('active')}>
            Aktivní
          </button>
          <button type="button" className={pillCls(scope === 'closed')} aria-pressed={scope === 'closed'} onClick={() => setScope('closed')}>
            Uzavřené
          </button>
        </div>
      </div>
      <Notice error={error} />
      {data && tasks.length === 0 && (
        <div className={hintCls}>{scope === 'active' ? 'Žádné úkoly v práci.' : 'Zatím žádné uzavřené úkoly.'}</div>
      )}
      <div className="flex flex-col gap-2.5">
        {tasks.map((t) => (
          <TaskCard
            key={t.documentId}
            task={t}
            role="manager"
            open={open === t.documentId}
            onToggle={() => setOpen(open === t.documentId ? null : t.documentId)}
            onSaved={replace}
            onConflict={() => void load(scope, true)}
          />
        ))}
      </div>
    </section>
  )
}
