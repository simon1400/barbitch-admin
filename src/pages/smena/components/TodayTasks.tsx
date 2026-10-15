// «Úkoly dnes» во вкладке «Směna» (s263, §0б плана): активные задачи администраторки — те же
// `TaskCard` из s262 («Hotovo», průběh, komentář, přílohy); хранение не копируется. После
// действия вкладка «Úkoly» и статус смены перечитываются (`onChanged`).
// s265: только задачи на ней (поставленные коллеге — во вкладке «Úkoly»); «Předat kolegyni».
import { useCallback, useEffect, useRef, useState } from 'react'

import { cardPadCls, cardTitleCls, hintCls, mutedCls } from '../../../ui/kit'
import { TaskCard } from '../../vykaz/components/TaskParts'
import { fetchTasks, isPeerTaskByMe, type AdminPerson, type Task } from '../../vykaz/fetch/tasks'

export function TodayTasks({ reloadKey, onChanged, onShowAll }: { reloadKey: number; onChanged: () => void; onShowAll: () => void }) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [colleagues, setColleagues] = useState<AdminPerson[]>([])
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    try {
      const res = await fetchTasks('active')
      if (my !== seq.current) return
      setTasks(res.tasks.filter((t) => !isPeerTaskByMe(t)))
      setColleagues((res.admins ?? []).filter((a) => a.documentId !== res.me))
      setError(null)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  return (
    <section className={cardPadCls} data-card="ukoly-dnes" data-testid="smena-ukoly">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h2 className={cardTitleCls}>Úkoly dnes</h2>
        <button type="button" className="text-[13px] font-bold text-brand-dark" onClick={onShowAll} data-show-all>
          Všechny úkoly →
        </button>
      </div>
      {error ? (
        <div className="text-[12.5px] font-semibold text-neg">{error}</div>
      ) : !tasks ? (
        <div className={mutedCls}>Načítání…</div>
      ) : tasks.length === 0 ? (
        <div className={hintCls}>Žádné otevřené úkoly.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tasks.map((t) => (
            <TaskCard
              key={t.documentId}
              task={t}
              role="administrator"
              open={open === t.documentId}
              onToggle={() => setOpen(open === t.documentId ? null : t.documentId)}
              onSaved={(nt) => {
                // передала — задача от неё ушла
                setTasks((ts) => (ts ? (nt.personal !== t.personal ? ts.filter((x) => x.documentId !== nt.documentId) : ts.map((x) => (x.documentId === nt.documentId ? nt : x))) : ts))
                onChanged()
              }}
              onConflict={() => void load()}
              admins={colleagues}
            />
          ))}
        </div>
      )}
    </section>
  )
}
