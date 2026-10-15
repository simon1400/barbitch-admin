// «Úkoly splněné dnes» на «Uzavření směny» (s263, §0б.4 плана «Směna»): задачи администраторек,
// отмеченные «hotovo» в этот день (по Праге), — по людям, с текущим статусом (převzato / čeká).
// Источник — события задач (`GET /engine/admin/smena/:date/summary`), отдельного поля в
// work-time нет. Сама загружает; пусто или ошибка источника — карточка не мешает закрытию.
// s266 (Фаза 3): под задачей — что она написала в этот день (hotovo / průběh / komentář) и вложения
// задачи (открываются ручкой задач `openTaskFile`, доступ проверяет сервер).
// s265: «Předání směny» — сообщения администраторок следующей смене за этот день (кому, текст,
// задачи, прочитано ли) — руководство видит их здесь же.
import { useEffect, useState } from 'react'

import { fetchSmenaSummary, type Handover, type SmenaSummaryPerson, type TaskDone } from '../../../smena/fetch/smena'
import { openTaskFile } from '../../../vykaz/fetch/tasks'
import { fmtTimePrague } from '../../../../utils/date'

const STATUS_LABEL: Record<string, string> = { accepted: 'převzato', done: 'čeká na převzetí', open: 'vráceno do práce', cancelled: 'zrušeno' }
const NOTE_LABEL: Record<string, string> = { done: 'hotovo', progress: 'průběh', comment: 'komentář' }

/** s266: текст её записей этого дня и вложения задачи. */
function TaskDetails({ task }: { task: TaskDone }) {
  const [fileErr, setFileErr] = useState<string | null>(null)
  const notes = task.notes ?? []
  const files = task.files ?? []
  if (!notes.length && !files.length) return null
  return (
    <div className="pl-6 pb-1" data-task-details={task.documentId}>
      {notes.map((n) => (
        <div key={`${n.kind}-${n.at}`} className="text-xs text-ink-muted whitespace-pre-line break-words" data-note={n.kind}>
          <span className="font-semibold">{NOTE_LABEL[n.kind] || n.kind}:</span> {n.text}
        </div>
      ))}
      {files.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
          {files.map((f) => (
            <button
              key={f.documentId}
              type="button"
              className="text-xs font-semibold text-brand-dark underline break-all"
              onClick={() => {
                setFileErr(null)
                openTaskFile(task.documentId, { ...f, uploadedBy: null, uploadedRole: null }).catch((e) => setFileErr((e as Error).message))
              }}
              data-task-file={f.documentId}
            >
              📎 {f.fileName}
            </button>
          ))}
        </div>
      )}
      {fileErr && <div className="text-xs text-neg">{fileErr}</div>}
    </div>
  )
}

export function TasksDoneCard({ date }: { date: string }) {
  const [people, setPeople] = useState<SmenaSummaryPerson[] | null>(null)
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setPeople(null)
    setHandovers([])
    setError(null)
    fetchSmenaSummary(date)
      .then((res) => {
        if (!alive) return
        setPeople(res.people.filter((p) => p.tasksDone.length > 0))
        setHandovers(res.handovers ?? [])
      })
      .catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [date])

  if (!error && (!people || people.length === 0) && handovers.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-line p-5 shadow-sm" data-card="tasks-done">
      {(error || (people && people.length > 0)) && <h3 className="font-semibold text-ink mb-2">Úkoly splněné dnes</h3>}
      {error ? (
        <p className="text-sm text-neg">Nepodařilo se načíst: {error}</p>
      ) : (
        <div className="space-y-2">
          {people?.map((p) => (
            <div key={p.documentId || p.name}>
              <div className="text-sm font-medium text-ink-body">{p.name || '—'}</div>
              {p.tasksDone.map((t) => (
                <div key={t.documentId}>
                  <div className="text-sm text-ink-muted flex justify-between gap-3 pl-3">
                    <span className="break-words">{t.title}</span>
                    <span className="whitespace-nowrap text-xs">
                      {fmtTimePrague(t.doneAt)} · {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  <TaskDetails task={t} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {handovers.length > 0 && (
        <div className={people && people.length > 0 ? 'mt-4 pt-3 border-t border-line-soft' : ''} data-testid="handovers">
          <h3 className="font-semibold text-ink mb-2">Předání směny</h3>
          <div className="space-y-2">
            {handovers.map((h) => (
              <div key={h.documentId} data-handover={h.documentId}>
                <div className="text-sm font-medium text-ink-body flex justify-between gap-3">
                  <span>
                    {h.fromName || '—'} → {h.toName || '—'}
                  </span>
                  <span className="whitespace-nowrap text-xs text-ink-muted">{h.readAt ? `přečteno ${fmtTimePrague(h.readAt)}` : 'nepřečteno'}</span>
                </div>
                {h.text && <div className="text-sm text-ink-muted pl-3 whitespace-pre-line break-words">{h.text}</div>}
                {h.tasks.map((t) => (
                  <div key={t.documentId} className="text-xs text-ink-muted pl-3">
                    {t.kind === 'new' ? '＋ nový úkol' : '↪ předaný'}: {t.title || '—'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
