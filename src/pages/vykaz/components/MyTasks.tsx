// «Úkoly» на странице /vykaz (s240): поручения управляющей — в работе и ждущие владельца,
// по кнопке — уже закрытые. Своя загрузка (сбой не трогает отчёт); `reloadKey` растёт после
// подачи отчёта с заметками по поручениям — их лента изменилась.
// s246: управляющая ставит задачи себе и владельцу («+ Nový úkol»); список в две группы —
// «Moje úkoly» (от владельца и свои) и «Úkoly pro majitele»; свои — «Upravit zadání».
// s247: `focus` — задача из push (`/vykaz?task=`): раскрыта и прокручена к себе; закрытой среди
// активных нет (владелец выполнил её задачу) — список сам переходит на «Uzavřené».
import { useCallback, useEffect, useRef, useState } from 'react'

import { btnPinkCls, cardPadCls, hintCls, labelCls, pillCls } from '../../../ui/kit'
import {
  assigneeOf,
  canEditTask,
  createTask,
  fetchTasks,
  updateTask,
  type Task,
  type TaskInput,
  type TaskScope,
  type TasksList,
} from '../fetch/tasks'
import { Notice } from './ReportParts'
import { TaskCard, TaskForm } from './TaskParts'

export default function MyTasks({ reloadKey, focus = null }: { reloadKey: number; focus?: string | null }) {
  const [scope, setScope] = useState<TaskScope>('active')
  const [data, setData] = useState<TasksList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(focus)
  // задача из push ещё не найдена в списке
  const focusRef = useRef(focus)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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

  useEffect(() => {
    const f = focusRef.current
    // ответ другого фильтра (переключение ещё в пути) — ждём свой
    if (!f || !data || data.scope !== scope) return
    if (data.tasks.some((t) => t.documentId === f)) {
      focusRef.current = null
      setTimeout(() => document.querySelector(`[data-task="${f}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0)
    } else if (scope === 'active') setScope('closed')
    else focusRef.current = null
  }, [data, scope])

  const replace = (t: Task) => setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.documentId === t.documentId ? t : x)) } : d))

  const submit = async (body: TaskInput, id?: string) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      if (id) {
        replace((await updateTask(id, body)).task)
        setEditing(null)
        setOk('Zadání upraveno.')
      } else {
        const res = await createTask(body)
        setCreating(false)
        setOpen(res.task.documentId)
        setOk(body.assignee === 'owner' ? 'Úkol pro majitele zadán.' : 'Úkol zadán.')
        // порядок (просроченные, срочные, по сроку) считает сервер
        void load(scope)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const tasks = data?.tasks ?? []
  const groups = [
    { key: 'mine', title: 'Moje úkoly', items: tasks.filter((t) => assigneeOf(t) === 'manager') },
    { key: 'owner', title: 'Úkoly pro majitele', items: tasks.filter((t) => assigneeOf(t) === 'owner') },
  ].filter((g) => g.items.length > 0)

  const card = (t: Task) =>
    editing === t.documentId && data ? (
      <section key={t.documentId} className={`${cardPadCls} !mb-0`} data-task-edit={t.documentId}>
        <TaskForm
          mode="manager"
          initial={t}
          people={[]}
          priorities={data.priorities}
          today={data.today}
          busy={busy}
          submitLabel="Uložit změny"
          onSubmit={(b) => void submit(b, t.documentId)}
          onCancel={() => setEditing(null)}
        />
      </section>
    ) : (
      <TaskCard
        key={t.documentId}
        task={t}
        role="manager"
        open={open === t.documentId}
        onToggle={() => setOpen(open === t.documentId ? null : t.documentId)}
        onSaved={(nt) => {
          replace(nt)
          // своя задача по «hotovo» закрывается сразу — уходит из «Aktivní», список перечитывается тихо
          if (scope !== 'all' && nt.status !== t.status) void load(scope)
        }}
        onConflict={() => void load(scope, true)}
        onEdit={canEditTask(t, 'manager') ? () => setEditing(t.documentId) : undefined}
      />
    )

  return (
    <section className={`${cardPadCls} !mb-0 mt-3.5`} data-testid="my-tasks">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="m-0 text-[17px] font-extrabold text-ink">Úkoly</h2>
        <div className="flex gap-1.5 flex-wrap items-center">
          <div className="flex gap-1.5" role="group" aria-label="Filtr úkolů">
            <button type="button" className={pillCls(scope === 'active')} aria-pressed={scope === 'active'} onClick={() => setScope('active')}>
              Aktivní
            </button>
            <button type="button" className={pillCls(scope === 'closed')} aria-pressed={scope === 'closed'} onClick={() => setScope('closed')}>
              Uzavřené
            </button>
          </div>
          <button type="button" className={btnPinkCls} onClick={() => setCreating((v) => !v)} aria-expanded={creating} disabled={!data} data-testid="task-new">
            + Nový úkol
          </button>
        </div>
      </div>
      <Notice error={error} ok={ok} />
      {creating && data && (
        <div className="mb-3.5 pb-3.5 border-b border-line-soft" data-testid="task-create">
          <TaskForm
            mode="manager"
            people={[]}
            priorities={data.priorities}
            today={data.today}
            busy={busy}
            submitLabel="Zadat úkol"
            onSubmit={(b) => void submit(b)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
      {data && tasks.length === 0 && (
        <div className={hintCls}>{scope === 'active' ? 'Žádné úkoly v práci.' : 'Zatím žádné uzavřené úkoly.'}</div>
      )}
      <div className="flex flex-col gap-3.5">
        {groups.map((g) => (
          <div key={g.key} data-testid={`my-tasks-${g.key}`}>
            <div className={labelCls}>{g.title}</div>
            <div className="flex flex-col gap-2.5">{g.items.map(card)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
