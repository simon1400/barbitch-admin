// Поручения владельца (s240): карточка поручения и форма. Карточку рисуют и вкладка
// владельца «Úkoly», и страница управляющей /vykaz — одно поручение обе стороны видят
// одинаково; кнопки — по роли (те же правила, что на сервере, `actionsFor`).
// s246: и задачи управляющей себе/владельцу — кнопки по стороне (исполнитель/постановщик),
// бейдж «откуда» (`originLabel`), форма управляющей — «Pro mě / Pro majitele».
// s253 (жалоба управляющей): раскрытие — заметная кнопка «Detail ⌄» вместо мелкого «▾»; на свёрнутой
// карточке — последнее событие ленты (кто, когда, начало текста; «vráceno» — жёлтым) и число записей.
// s258: свой комментарий / ход работы автор удаляет (✕ у записи) — бесследно, без записи в ленте.
// s262: задачи администраторам — в форме «Pro administrátorky» + выбор (конкретная или «všem»),
// на карточке — кому; администраторка видит карточку с ролью `administrator`.
// s265: «Předat kolegyni» — передать задачу другой администраторке (исполнительнице и руководству,
// `admins` — кому можно); «předáno · от → кому» в ленте жёлтым; у задачи коллеге кнопки по флагам
// сервера `forMe`/`byMe` (обе стороны — администраторки).
import { useRef, useState } from 'react'

import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  btnNeutralCls,
  btnPinkCls,
  cardPadCls,
  hintCls,
  inputCls,
  labelCls,
  pillCls,
  selectCls,
} from '../../../ui/kit'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { IconChevronDown } from '../../calendar/icons'
import { ApiError } from '../../../lib/apiFetch'
import { getSession } from '../../../services/auth'
import {
  ACCEPT_TASK_FILE,
  EVENT_LABEL,
  REMOVABLE_EVENTS,
  actionsFor,
  assigneeOf,
  canHandover,
  canProgress,
  closesOnDone,
  creatorOf,
  deleteTaskFile,
  handoverTask,
  sidesOf,
  openTaskFile,
  originLabel,
  removeTaskEvent,
  statusLabel,
  taskAction,
  uploadTaskFile,
  type AdminPerson,
  type Task,
  type TaskAction,
  type TaskEvent,
  type TaskInput,
  type TaskPriority,
  type TaskSide,
  type TaskStatus,
} from '../fetch/tasks'

const stamp = (iso: string | null | undefined): string => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '—')

const STATUS_CLS: Record<TaskStatus, string> = {
  open: badgeMutedCls,
  done: badgeWarnCls,
  accepted: badgePosCls,
  cancelled: badgeMutedCls,
}

/** Статус, откуда задача (s246), срочность, срок. */
export function TaskBadges({
  task,
  role = 'manager',
  origin = null,
}: {
  task: Pick<Task, 'status' | 'priority' | 'dueDate' | 'overdue' | 'assignee' | 'createdByRole'>
  role?: TaskSide
  origin?: string | null
}) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap" data-testid="task-badges">
      <span className={`${STATUS_CLS[task.status]} whitespace-nowrap`} data-status={task.status}>
        {statusLabel(task, role)}
      </span>
      {origin && (
        <span className={`${badgeMutedCls} whitespace-nowrap`} data-origin={origin}>
          {origin}
        </span>
      )}
      {task.priority === 'urgent' && <span className={`${badgeNegCls} whitespace-nowrap`}>urgentní</span>}
      {task.dueDate && (
        <span className={`${task.overdue ? badgeNegCls : badgeMutedCls} whitespace-nowrap`} data-overdue={task.overdue ? '1' : undefined}>
          {task.overdue ? 'po termínu · ' : 'do '}
          {fmtCsDate(task.dueDate)}
        </span>
      )}
    </span>
  )
}

const ACTION_LABEL: Record<TaskAction, string> = {
  done: 'Hotovo',
  undone: 'Ještě není hotovo',
  progress: 'Zapsat průběh',
  comment: 'Komentář',
  accept: 'Převzít',
  reopen: 'Vrátit do práce',
  cancel: 'Zrušit úkol',
  handover: 'Předat kolegyni',
}

/** «předáno» и «vráceno» — жёлтым (задача поменяла руки или вернулась). */
const isTurn = (kind: TaskEvent['kind'] | undefined) => kind === 'reopen' || kind === 'undone' || kind === 'handover'

const ROLE_LABEL: Record<string, string> = { owner: 'majitel', manager: 'manažerka', administrator: 'administrátorka' }

/** s262: кому задача администратора — имя или «všem». */
const ALL_ADMINS_LABEL = 'Všem administrátorkám'

/**
 * Поручение: шапка (раскрыть), описание, вложения, лента, ответ и действия по роли.
 * `onSaved` — новая версия поручения с сервера; `onConflict` — 409, перечитать список.
 */
export function TaskCard({
  task,
  role,
  open,
  onToggle,
  onSaved,
  onConflict,
  onEdit,
  showAssignee,
  admins = [],
}: {
  task: Task
  role: TaskSide
  open: boolean
  onToggle: () => void
  onSaved: (t: Task) => void
  onConflict: () => void
  onEdit?: () => void
  showAssignee?: boolean
  /** s265: кому можно передать (работающие администраторки); пусто — кнопки нет */
  admins?: AdminPerson[]
}) {
  const [text, setText] = useState('')
  const [handTo, setHandTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const actions = actionsFor(task, role)
  // ход работы — исполнителю-управляющей в работе; комментарий — всегда
  const textAction: TaskAction = canProgress(task, role) ? 'progress' : 'comment'

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      if (e instanceof ApiError && e.code === 'task_changed') onConflict()
      return false
    } finally {
      setBusy(false)
    }
  }

  const act = (action: TaskAction, withText: string) =>
    run(async () => {
      const res = await taskAction(task.documentId, action, withText)
      onSaved(res.task)
      setText('')
    })

  const addFiles = (list: FileList | null) => {
    const files = [...(list || [])]
    if (fileRef.current) fileRef.current.value = ''
    if (!files.length) return
    void run(async () => {
      const added = []
      for (const f of files.slice(0, Math.max(0, 10 - task.files.length))) added.push(await uploadTaskFile(task.documentId, f))
      onSaved({ ...task, files: [...task.files, ...added] })
    })
  }

  const removeFile = (fid: string) =>
    run(async () => {
      await deleteTaskFile(task.documentId, fid)
      onSaved({ ...task, files: task.files.filter((f) => f.documentId !== fid) })
    })

  // s265: передать — без текущей исполнительницы; заметка — из общего поля текста
  const handCandidates = canHandover(task, role) ? admins.filter((a) => a.documentId !== task.personal) : []
  const handover = () =>
    handTo &&
    run(async () => {
      const res = await handoverTask(task.documentId, handTo, text.trim())
      setHandTo(null)
      setText('')
      onSaved(res.task)
    })

  const removeEvent = (ev: TaskEvent) => {
    if (!window.confirm('Smazat záznam? V průběhu po něm nezůstane stopa.')) return
    void run(async () => {
      const res = await removeTaskEvent(task.documentId, ev.at)
      onSaved(res.task)
    })
  }

  const canRemove = (uploadedRole: string | null) => role === 'owner' || uploadedRole === role
  // своя запись с текстом — та же проверка, что на сервере (автор и роль)
  const me = getSession()?.username ?? ''
  const canRemoveEvent = (ev: TaskEvent) => REMOVABLE_EVENTS.includes(ev.kind) && ev.role === role && ev.by === me
  const closed = task.status === 'accepted' || task.status === 'cancelled'
  // последнее событие ленты, кроме самого «zadáno» — его и так видно по карточке
  const last = task.events.length ? task.events[task.events.length - 1] : null
  const lastShown = last && last.kind !== 'created' ? last : null
  const returned = isTurn(lastShown?.kind)
  const quick = closesOnDone(task)
  const mineToDo = sidesOf(task, role).isAssignee
  // подсказка под кнопками — по стороне задачи (s246)
  const creatorLabel = creatorOf(task) === 'owner' ? 'majiteli' : 'manažerce'
  const toAdmins = assigneeOf(task) === 'administrator'
  // s265: задача администраторки коллеге
  const peer = creatorOf(task) === 'administrator'
  const hint =
    peer && task.status === 'open'
      ? role !== 'administrator'
        ? 'Úkol zadala administrátorka kolegyni — můžete komentovat nebo ho předat.'
        : mineToDo
          ? '«Hotovo» úkol uzavře — kolegyně uvidí, že je splněno.'
          : 'Úkol plní kolegyně — až ho označí jako hotový, přijde vám upozornění.'
      : task.status === 'open' && mineToDo && role === 'administrator'
      ? `«Hotovo» pošle úkol ${creatorLabel} k převzetí.`
      : task.status === 'done' && actions.includes('undone') && role === 'administrator'
        ? `«Ještě není hotovo» vrátí úkol do práce — ${creatorOf(task) === 'owner' ? 'majitel' : 'manažerka'} ho zatím nepřevzal${creatorOf(task) === 'owner' ? '' : 'a'}.`
        : toAdmins && task.status === 'open' && creatorOf(task) === role
          ? 'Úkol plní administrátorka — převezmete ho, až ho označí jako hotový.'
          : toAdmins && !actions.length && !closed
            ? `Úkol zadal${creatorOf(task) === 'owner' ? ' majitel' : 'a manažerka'} — můžete jen komentovat.`
            : task.status === 'open' && mineToDo && role === 'manager'
      ? quick
        ? '«Hotovo» úkol uzavře. Průběh můžete psát i ve výkazu dne.'
        : '«Hotovo» pošle úkol majiteli k převzetí. Průběh můžete psát i ve výkazu dne.'
      : task.status === 'done' && actions.includes('undone')
        ? '«Ještě není hotovo» vrátí úkol do práce — majitel ho zatím nepřevzal.'
        : task.status === 'open' && mineToDo && role === 'owner'
          ? creatorOf(task) === 'manager'
            ? '«Hotovo» úkol uzavře — manažerka uvidí, že je splněno.'
            : '«Hotovo» úkol uzavře.'
          : task.status === 'open' && !mineToDo && quick && role === 'manager'
            ? 'Úkol splní majitel. Zadání můžete upravit nebo úkol zrušit.'
            : !actions.length && !mineToDo && role === 'owner' && !closed
              ? 'Vlastní úkol manažerky — můžete jen komentovat.'
              : null

  return (
    <section
      className={`${cardPadCls} !mb-0 scroll-mt-52 md:scroll-mt-44 ${task.overdue ? '!border-neg-line' : actions.includes('accept') ? '!border-warn-line' : ''}`}
      data-task={task.documentId}
      data-task-status={task.status}
      data-task-assignee={assigneeOf(task)}
    >
      <button type="button" className="w-full text-left flex items-start gap-3" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-extrabold ${closed ? 'text-ink-soft' : 'text-ink'} break-words`}>{task.title}</span>
          <span className="block mt-1">
            <TaskBadges task={task} role={role} origin={originLabel(task, role)} />
          </span>
          {(toAdmins ? (task.allAdmins ? ALL_ADMINS_LABEL : task.personalName) : showAssignee && task.personalName) && (
            <span className="block text-[12px] font-semibold text-ink-faint mt-1" data-task-for={toAdmins ? (task.allAdmins ? 'all' : 'one') : undefined}>
              {toAdmins ? (task.allAdmins ? ALL_ADMINS_LABEL : `Pro: ${task.personalName}`) : task.personalName}
            </span>
          )}
        </span>
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-line-btn px-2.5 py-1 text-[12.5px] font-bold text-brand-dark bg-white"
          data-testid="task-toggle"
        >
          {open ? 'Skrýt' : 'Detail'}
          <IconChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {!open && lastShown && (
        <button
          type="button"
          className={`mt-2.5 w-full text-left rounded-lg px-3 py-2 text-[12.5px] font-semibold ${returned ? 'bg-warn-bg text-warn' : 'bg-surface-input text-ink-soft'}`}
          onClick={onToggle}
          data-testid="task-last-event"
          data-event={lastShown.kind}
        >
          <span className="font-bold">
            {EVENT_LABEL[lastShown.kind] ?? lastShown.kind} · {lastShown.by} · {stamp(lastShown.at)}
          </span>
          {lastShown.kind === 'handover' && (
            <span className="block truncate text-ink-body">
              {lastShown.from || '—'} → {lastShown.to || '—'}
            </span>
          )}
          {lastShown.text && <span className="block truncate text-ink-body">{lastShown.text}</span>}
          {task.events.length > 1 && <span className="block text-ink-faint">Záznamů v průběhu: {task.events.length}</span>}
        </button>
      )}

      {open && (
        <div className="mt-3.5 pt-3.5 border-t border-line-soft flex flex-col gap-3.5" data-testid="task-detail">
          {error && (
            <div role="alert" className={`${badgeNegCls} !text-[12.5px] !px-3 !py-2 block`}>
              {error}
            </div>
          )}
          {task.description && (
            <div className="text-[14px] font-semibold text-ink-body whitespace-pre-wrap break-words" data-testid="task-description">
              {task.description}
            </div>
          )}
          <div className="text-[12px] font-semibold text-ink-faint">
            Zadáno {stamp(task.createdAt)}
            {task.createdByName ? ` · ${task.createdByName}` : ''}
          </div>

          <div>
            <div className={labelCls}>Přílohy</div>
            {task.files.length > 0 && (
              <ul className="m-0 p-0 list-none flex flex-col gap-1 mb-2" data-testid="task-files">
                {task.files.map((f) => (
                  <li key={f.documentId} className="flex items-center gap-2 text-[13px] font-semibold">
                    <button
                      type="button"
                      className="text-brand-dark hover:underline min-w-0 truncate text-left"
                      onClick={() => void openTaskFile(task.documentId, f).catch((e) => setError((e as Error).message))}
                    >
                      📎 {f.fileName}
                    </button>
                    <span className="text-ink-faint text-[11.5px] whitespace-nowrap">{f.uploadedBy ? `· ${f.uploadedBy}` : ''}</span>
                    {canRemove(f.uploadedRole) && (
                      <button
                        type="button"
                        className="text-ink-faint hover:text-neg text-[13px] ml-auto"
                        aria-label={`Smazat ${f.fileName}`}
                        disabled={busy}
                        onClick={() => void removeFile(f.documentId)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {task.status !== 'cancelled' && task.files.length < 10 && (
              <label className={`${btnNeutralCls} inline-flex cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                + Přidat fotku / PDF
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT_TASK_FILE}
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                  data-testid="task-file-input"
                />
              </label>
            )}
          </div>

          {task.events.length > 0 && (
            <div>
              <div className={labelCls}>Průběh</div>
              <ol className="m-0 p-0 list-none flex flex-col gap-1.5" data-testid="task-events">
                {task.events.map((ev, i) => (
                  <li
                    key={i}
                    data-event={ev.kind}
                    className={`rounded-lg px-3 py-2 ${ev.kind === 'handover' ? 'bg-warn-bg' : ev.role === 'owner' ? 'bg-brand-tint' : 'bg-surface-input'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="text-[11.5px] font-bold text-ink-soft min-w-0 flex-1">
                        {EVENT_LABEL[ev.kind] ?? ev.kind} · {ev.by} · {ROLE_LABEL[ev.role] ?? ev.role} · {stamp(ev.at)}
                        {ev.reportDate ? ` · z výkazu ${fmtCsDate(ev.reportDate)}` : ''}
                      </div>
                      {canRemoveEvent(ev) && (
                        <button
                          type="button"
                          className="shrink-0 text-ink-faint hover:text-neg text-[13px] leading-none"
                          aria-label="Smazat záznam"
                          title="Smazat záznam"
                          disabled={busy}
                          onClick={() => removeEvent(ev)}
                          data-testid="task-event-remove"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {ev.kind === 'handover' && (
                      <div className="text-[13.5px] font-bold text-warn" data-handover-route>
                        {ev.from || '—'} → {ev.to || '—'}
                      </div>
                    )}
                    {ev.text && <div className="text-[14px] font-semibold text-ink-body whitespace-pre-wrap break-words">{ev.text}</div>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                textAction === 'progress'
                  ? 'Jak to jde? Co je hotovo, co zbývá… (u «Hotovo» volitelné)'
                  : actions.includes('accept')
                    ? 'Komentář (u «Vrátit do práce» napište, co chybí)…'
                    : actions.includes('undone')
                      ? 'Komentář (u «Ještě není hotovo» napište, co chybí — volitelné)…'
                      : 'Komentář…'
              }
              rows={2}
              maxLength={2000}
              className={`${inputCls} w-full resize-y`}
              data-testid="task-text"
            />
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                className={btnNeutralCls}
                disabled={busy || !text.trim()}
                onClick={() => void act(textAction, text.trim())}
                data-testid="task-send"
              >
                {textAction === 'progress' ? 'Zapsat průběh' : 'Odeslat komentář'}
              </button>
              {actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={a === 'done' || a === 'accept' ? btnPinkCls : btnNeutralCls}
                  disabled={busy}
                  onClick={() => void act(a, text.trim())}
                  data-action={a}
                >
                  {ACTION_LABEL[a]}
                </button>
              ))}
              {handCandidates.length > 0 && handTo === null && (
                <button type="button" className={btnNeutralCls} disabled={busy} onClick={() => setHandTo(handCandidates.length === 1 ? handCandidates[0].documentId : '')} data-action="handover">
                  {ACTION_LABEL.handover}
                </button>
              )}
              {onEdit && !closed && (
                <button type="button" className="text-[12.5px] font-bold text-brand-dark hover:underline ml-auto" onClick={onEdit}>
                  Upravit zadání
                </button>
              )}
            </div>
            {handTo !== null && (
              <div className="flex gap-2 flex-wrap items-end rounded-lg bg-warn-bg px-3 py-2.5" data-testid="task-handover">
                <label className="block">
                  <span className={labelCls}>Předat komu</span>
                  <select className={selectCls} value={handTo} onChange={(e) => setHandTo(e.target.value)} data-testid="task-handover-to">
                    {handCandidates.length > 1 && <option value="">— vyberte —</option>}
                    {handCandidates.map((p) => (
                      <option key={p.documentId} value={p.documentId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className={btnPinkCls} disabled={busy || !handTo} onClick={() => void handover()} data-testid="task-handover-submit">
                  Předat
                </button>
                <button type="button" className={btnNeutralCls} disabled={busy} onClick={() => setHandTo(null)}>
                  Zrušit
                </button>
                <div className={`${hintCls} w-full`}>Text z pole výše se připíše jako poznámka k předání. Kdo úkol zadal, dostane upozornění.</div>
              </div>
            )}
            {hint && <div className={hintCls}>{hint}</div>}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Форма задачи: новое или правка. `mode` — кто ставит: владелец — «Pro manažerku / Pro mě»
 * (s259; управляющей — выбор «Komu», себе — без карточки), управляющая (s246) — «Pro mě /
 * Pro majitele» (карточку сервер берёт из сессии). `defaultAssignee` — выбор при открытии.
 * s262: обоим — «Pro administrátorky» (если есть кому): выбор администраторки или «všem».
 */
export function TaskForm({
  initial,
  people,
  priorities,
  today,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
  mode = 'owner',
  defaultAssignee = 'manager',
  admins = [],
}: {
  initial?: Partial<Task>
  mode?: TaskSide
  defaultAssignee?: TaskSide
  admins?: AdminPerson[]
  people: { documentId: string; name: string; isActive: boolean }[]
  priorities: { key: string; label: string }[]
  today: string
  busy: boolean
  onSubmit: (body: TaskInput) => void
  onCancel?: () => void
  submitLabel: string
}) {
  const active = people.filter((p) => p.isActive)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'normal')
  const [personal, setPersonal] = useState(initial?.personal ?? (active.length === 1 ? active[0].documentId : ''))
  const [assignee, setAssignee] = useState<TaskSide>(defaultAssignee === 'administrator' && !admins.length ? 'manager' : defaultAssignee)
  // s262: '*' — всем администраторкам
  const [adminPick, setAdminPick] = useState(admins.length === 1 ? admins[0].documentId : '')
  const editing = !!initial?.documentId
  const asManager = mode === 'manager'
  // владельцу «Komu» нужно только для поручения управляющей
  const needsPersonal = !editing && !asManager && assignee === 'manager'
  const forAdmins = !editing && assignee === 'administrator'
  const sides: (readonly [TaskSide, string])[] = [
    ...(asManager
      ? ([
          ['manager', 'Pro mě'],
          ['owner', 'Pro majitele'],
        ] as const)
      : ([
          ['manager', 'Pro manažerku'],
          ['owner', 'Pro mě'],
        ] as const)),
    ...(admins.length ? ([['administrator', 'Pro administrátorky']] as const) : []),
  ]
  return (
    <div className="flex flex-col gap-3" data-testid="task-form">
      {!editing && (
        <div className="flex gap-1.5" role="group" aria-label="Pro koho" data-testid="task-assignee">
          {sides.map(([key, label]) => (
            <button key={key} type="button" className={pillCls(assignee === key)} aria-pressed={assignee === key} onClick={() => setAssignee(key)} data-assignee={key}>
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <span className={labelCls}>Co je potřeba udělat *</span>
        <input className={`${inputCls} w-full`} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="task-title" />
      </label>
      <label className="block">
        <span className={labelCls}>Popis</span>
        <textarea
          className={`${inputCls} w-full resize-y`}
          rows={3}
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="task-description-input"
        />
      </label>
      <div className="flex gap-3 flex-wrap">
        {forAdmins && (
          <label className="block">
            <span className={labelCls}>Komu *</span>
            <select className={selectCls} value={adminPick} onChange={(e) => setAdminPick(e.target.value)} data-testid="task-admin">
              <option value="">— vyberte —</option>
              <option value="*">{ALL_ADMINS_LABEL}</option>
              {admins.map((p) => (
                <option key={p.documentId} value={p.documentId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {needsPersonal && active.length > 1 && (
          <label className="block">
            <span className={labelCls}>Komu *</span>
            <select className={selectCls} value={personal} onChange={(e) => setPersonal(e.target.value)} data-testid="task-personal">
              <option value="">— vyberte —</option>
              {active.map((p) => (
                <option key={p.documentId} value={p.documentId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Termín</span>
          <input
            type="date"
            className={inputCls}
            min={editing && initial?.dueDate && initial.dueDate < today ? undefined : today}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            data-testid="task-due"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Priorita</span>
          <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} data-testid="task-priority">
            {priorities.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={btnPinkCls}
          disabled={busy || !title.trim() || (needsPersonal && !personal) || (forAdmins && !adminPick)}
          onClick={() =>
            onSubmit({
              ...(editing
                ? {}
                : forAdmins
                  ? { assignee, ...(adminPick === '*' ? { allAdmins: true } : { personal: adminPick }) }
                  : asManager || assignee === 'owner'
                    ? { assignee }
                    : { personal }),
              title: title.trim(),
              description,
              dueDate: dueDate || null,
              priority,
            })
          }
          data-testid="task-submit"
        >
          {busy ? 'Ukládám…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={btnNeutralCls} disabled={busy} onClick={onCancel}>
            Zrušit
          </button>
        )}
      </div>
    </div>
  )
}
