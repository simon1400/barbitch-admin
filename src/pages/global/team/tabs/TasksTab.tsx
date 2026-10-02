// Вкладка «Úkoly» модуля «Команда» (s240) — только владелец: поручения управляющей.
//
// Новое поручение (что, описание, срок, приоритет, кому), список с фильтром
// «Aktivní / Uzavřené / Vše»: раскрыть → лента, вложения, «Převzít», «Vrátit do práce»,
// «Zrušit», комментарий, «Upravit zadání». Ссылки с «Сегодня» — `?task=<id>` раскрывают его.
// Поздний ответ прежнего фильтра в экран не ложится (номер запроса).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { btnPinkCls, cardPadCls, hintCls, pillCls, toolbarCardCls } from '../../../../ui/kit'
import { TaskCard, TaskForm } from '../../../vykaz/components/TaskParts'
import { Notice } from '../../../vykaz/components/ReportParts'
import { createTask, fetchTasks, updateTask, type Task, type TaskInput, type TaskScope, type TasksList } from '../../../vykaz/fetch/tasks'

const SCOPES: { key: TaskScope; label: string }[] = [
  { key: 'active', label: 'Aktivní' },
  { key: 'closed', label: 'Uzavřené' },
  { key: 'all', label: 'Vše' },
]

export default function TasksTab() {
  const [params] = useSearchParams()
  const [scope, setScope] = useState<TaskScope>('active')
  const [data, setData] = useState<TasksList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(params.get('task'))
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const load = useCallback(async (sc: TaskScope, keepError = false) => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await fetchTasks(sc)
      if (my !== seq.current) return
      setData(res)
      if (!keepError) setError(null)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(scope)
  }, [load, scope])

  const replace = (t: Task) => setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.documentId === t.documentId ? t : x)) } : d))

  const submit = async (body: TaskInput, id?: string) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      if (id) {
        const res = await updateTask(id, body)
        replace(res.task)
        setEditing(null)
        setOk('Zadání upraveno.')
      } else {
        const res = await createTask(body)
        setCreating(false)
        setOpen(res.task.documentId)
        setOk('Úkol zadán.')
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
  const waiting = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter((t) => t.overdue).length

  return (
    <div data-testid="tasks-tab">
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filtr úkolů">
          {SCOPES.map((s) => (
            <button key={s.key} type="button" className={pillCls(scope === s.key)} aria-pressed={scope === s.key} onClick={() => setScope(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className={btnPinkCls} onClick={() => setCreating((v) => !v)} aria-expanded={creating} data-testid="task-new">
          + Nový úkol
        </button>
      </div>

      <Notice error={error} ok={ok} />

      {creating && data && (
        <section className={cardPadCls} data-testid="task-create">
          <TaskForm
            people={data.people ?? []}
            priorities={data.priorities}
            today={data.today}
            busy={busy}
            submitLabel="Zadat úkol"
            onSubmit={(b) => void submit(b)}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}

      {data && scope === 'active' && (waiting > 0 || overdue > 0) && (
        <div className={`${hintCls} mb-3`} data-testid="tasks-summary">
          {waiting > 0 && `Čeká na převzetí: ${waiting}. `}
          {overdue > 0 && `Po termínu: ${overdue}.`}
        </div>
      )}

      {!data ? (
        <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">{loading ? 'Načítání…' : ''}</div>
      ) : tasks.length === 0 ? (
        <div className={`${cardPadCls} ${hintCls}`}>
          {scope === 'active' ? 'Žádné rozpracované úkoly.' : scope === 'closed' ? 'Zatím žádné uzavřené úkoly.' : 'Zatím žádné úkoly.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5" data-testid="tasks-list">
          {tasks.map((t) =>
            editing === t.documentId ? (
              <section key={t.documentId} className={cardPadCls} data-task-edit={t.documentId}>
                <TaskForm
                  initial={t}
                  people={data.people ?? []}
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
                role="owner"
                open={open === t.documentId}
                onToggle={() => setOpen(open === t.documentId ? null : t.documentId)}
                onSaved={(nt) => {
                  replace(nt)
                  // принятое/отменённое уходит из «Aktivní» — список перечитывается тихо
                  if (scope !== 'all' && nt.status !== t.status) void load(scope)
                }}
                onConflict={() => void load(scope, true)}
                onEdit={() => setEditing(t.documentId)}
                showAssignee={(data.people ?? []).filter((p) => p.isActive).length > 1}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
