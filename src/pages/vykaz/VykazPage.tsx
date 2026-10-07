// «Výkaz práce» `/vykaz` (s239) — ежедневный отчёт управляющей владельцу.
//
// День выбирается в сетке месяца (сегодня по умолчанию; назад — до окна дозаполнения,
// не раньше начала отсчёта). Нет отчёта — форма; есть — просмотр + «Upravit» (пока
// день в окне), отметка «přečteno», оценка владельца и нить комментариев.
// Незаконченная форма живёт в черновике браузера (на телефоне легко потерять вкладку).
// Ответ месяца проверяется по номеру запроса и по месяцу: поздний ответ другого
// месяца/дня не ложится в форму (урок s227).
// s240: в форме — блок «Moje úkoly» (до s246 «Úkoly od majitele») (ход работы / «hotovo» по поручениям — уходит в их
// ленту), ниже дня — раздел поручений целиком (лента, вложения, «Hotovo»).
// s245: у поручения, ждущего владельца, галочка «Hotovo» стоит и снимается — в тело уходит
// `undone: true`, сервер возвращает поручение в работу (пока владелец не принял).
// s247: переход из push — `?date=` (výkaz za včerejšek) выбирает день, `?task=` раскрывает задачу;
// query читается один раз и чистится (обновление страницы не прыгает туда же). Кнопка «Upozornění».
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { btnNeutralCls, btnPinkCls, cardPadCls, hintCls, iconBtnCls, inputCls, kickerCls, labelCls, pageShellCls, selectCls } from '../../ui/kit'
import { WEEKDAYS_CS, dowOfYmd, fmtCsDate, todayYmd } from '../../utils/date'
import { ApiError } from '../../lib/apiFetch'
import {
  CommentThread,
  HistoryList,
  MonthCategories,
  MonthGrid,
  Notice,
  ReportContentView,
  ReportStatusLine,
  SystemFactsStrip,
} from './components/ReportParts'
import { TaskBadges } from './components/TaskParts'
import MyTasks from './components/MyTasks'
import { NotificationButton } from '../calendar/NotificationButton'
import {
  DAY_STATE_LABEL,
  commentMyReport,
  fetchMyReports,
  fmtHours,
  monthLabelCs,
  planBefore,
  saveMyReport,
  shiftMonth,
  type MyReports,
  type ReportItem,
  type WorkReport,
} from './fetch/workReports'

interface TaskDraft {
  done: boolean
  note: string
  /** «hotovo» снято у поручения, ждущего владельца (s245) */
  undone?: boolean
}

interface Draft {
  hours: string
  items: ReportItem[]
  done: string
  carried: string
  needsOwner: string
  planTomorrow: string
  /** заметки по поручениям: id → «hotovo» + текст (s240) */
  tasks: Record<string, TaskDraft>
}

const EMPTY_ITEM: ReportItem = { category: 'other', text: '' }
const emptyDraft = (): Draft => ({ hours: '', items: [{ ...EMPTY_ITEM }], done: '', carried: '', needsOwner: '', planTomorrow: '', tasks: {} })

const fromReport = (r: WorkReport): Draft =>
  r.status === 'submitted'
    ? {
        hours: r.hours == null ? '' : String(r.hours).replace('.', ','),
        items: r.items.length ? r.items.map((i) => ({ ...i })) : [{ ...EMPTY_ITEM }],
        done: r.done,
        carried: r.carried,
        needsOwner: r.needsOwner,
        planTomorrow: r.planTomorrow,
        tasks: Object.fromEntries((r.taskNotes ?? []).map((n) => [n.taskId, { done: n.done, note: n.note, ...(n.undone ? { undone: true } : {}) }])),
      }
    : emptyDraft()

// черновик формы — удобство одного браузера; без хранилища страница работает так же
const DRAFT_KEY = (date: string) => `vykaz-draft:${date}`
const readDraft = (date: string): Draft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(date))
    const d = raw ? (JSON.parse(raw) as Draft) : null
    // черновик до s240 — без поручений
    return d && Array.isArray(d.items) ? { ...d, tasks: d.tasks && typeof d.tasks === 'object' ? d.tasks : {} } : null
  } catch {
    return null
  }
}
const writeDraft = (date: string, d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY(date), JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY(date))
  } catch {
    /* хранилище недоступно — черновика просто не будет */
  }
}

const dayTitle = (date: string) => `${WEEKDAYS_CS[dowOfYmd(date)]} ${fmtCsDate(date)}`

const textAreaCls = `${inputCls} w-full resize-y`

/** Параметры перехода из push: день (не будущий) и задача. */
const readBoot = (search: string): { date: string | null; task: string | null } => {
  const p = new URLSearchParams(search)
  const d = p.get('date') || ''
  const t = p.get('task') || ''
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayYmd() ? d : null,
    task: /^[a-z0-9]{10,40}$/.test(t) ? t : null,
  }
}

export default function VykazPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const boot = useRef<ReturnType<typeof readBoot> | null>(null)
  if (boot.current === null) boot.current = readBoot(location.search)
  const [date, setDate] = useState(() => boot.current?.date ?? todayYmd())
  const [month, setMonth] = useState(() => (boot.current?.date ?? todayYmd()).slice(0, 7))
  const [data, setData] = useState<MyReports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dayOff, setDayOff] = useState(false)
  const [reason, setReason] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  // после подачи отчёта с заметками по поручениям раздел поручений перечитывается
  const [tasksKey, setTasksKey] = useState(0)
  const seq = useRef(0)
  // текущие день и месяц для ответов, пришедших после смены дня (замыкание держит старые)
  const dateRef = useRef(date)
  const monthRef = useRef(month)

  // keepError — перечитать после 409, не стирая его текст
  const load = useCallback(async (m: string, keepError = false) => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await fetchMyReports(m)
      if (my !== seq.current || res.month !== m) return
      setData(res)
      if (!keepError) setError(null)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    monthRef.current = month
    void load(month)
  }, [load, month])

  const report = data?.reports.find((r) => r.date === date) ?? null
  const inWindow = !!data && date >= data.earliest && date <= data.today
  const showForm = inWindow && (!report || editing)

  // смена дня: форма — из черновика или пустая, режим просмотра
  const pickDay = useCallback((d: string) => {
    dateRef.current = d
    setDate(d)
    setEditing(false)
    setDayOff(false)
    setOk(null)
    setError(null)
    setDraft(readDraft(d) ?? emptyDraft())
  }, [])

  // первая загрузка: черновик дня (сегодня или из push); query из push — убрать из адреса
  useEffect(() => {
    setDraft(readDraft(dateRef.current) ?? emptyDraft())
    if (location.search) navigate(location.pathname, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (patch: Partial<Draft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      writeDraft(date, next)
      return next
    })
  }
  const setItem = (i: number, patch: Partial<ReportItem>) =>
    update({ items: draft.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })

  const prevPlan = data ? planBefore(data.reports, date) : null
  const insertPlan = () => {
    if (!prevPlan) return
    const lines = prevPlan.planTomorrow
      .split('\n')
      .map((l) => l.replace(/^[-•*\s]+/, '').trim())
      .filter(Boolean)
    const kept = draft.items.filter((it) => it.text.trim())
    update({ items: [...kept, ...lines.map((text) => ({ category: 'other', text }))].slice(0, 20) })
  }

  const startEdit = () => {
    if (!report) return
    setDraft(readDraft(date) ?? fromReport(report))
    setDayOff(report.status === 'day_off')
    setReason(report.dayOffReason ?? '')
    setEditing(true)
    setOk(null)
  }

  const save = async () => {
    const forDate = date
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const { tasks, ...fields } = draft
      const body = dayOff
        ? ({ status: 'day_off', dayOffReason: reason } as const)
        : ({
            status: 'submitted',
            ...fields,
            tasks: Object.entries(tasks)
              .filter(([, t]) => t.done || t.undone || t.note.trim())
              .map(([id, t]) => ({ id, done: t.done, note: t.note, ...(t.undone && !t.done ? { undone: true } : {}) })),
          } as const)
      const res = await saveMyReport(forDate, body)
      writeDraft(forDate, null)
      if (forDate === dateRef.current) {
        ++seq.current // ответ сохранения свежее любой загрузки, что ещё в пути
        setData(res)
        setMonth(res.month)
        setLoading(false)
        setEditing(false)
        setOk(body.status === 'day_off' ? 'Uloženo jako nepracovní den.' : 'Výkaz odeslán. Děkujeme!')
        if (body.status === 'submitted' && body.tasks.length) setTasksKey((k) => k + 1)
      } else {
        // пока сохранялось, выбран другой день — форму не трогаем, месяц перечитываем
        void load(monthRef.current)
      }
    } catch (e) {
      if (forDate !== dateRef.current) return
      setError((e as Error).message)
      // výkaz se mezitím změnil — načíst znovu, text formuláře zůstává
      if (e instanceof ApiError && e.code === 'report_changed') void load(monthRef.current, true)
    } finally {
      setSaving(false)
    }
  }

  const sendComment = async (text: string) => {
    const forDate = date
    try {
      const res = await commentMyReport(forDate, text)
      setData((d) => (d ? { ...d, reports: d.reports.map((r) => (r.documentId === res.saved.documentId ? res.saved : r)) } : d))
      return true
    } catch (e) {
      if (forDate === dateRef.current) setError((e as Error).message)
      if (e instanceof ApiError && e.code === 'report_changed') void load(monthRef.current, true)
      return false
    }
  }

  const canPrev = !!data && month > data.since.slice(0, 7)
  const canNext = !!data && month < data.today.slice(0, 7)
  const dayState = data?.days.find((d) => d.date === date)?.state

  return (
    <div className={pageShellCls} data-testid="vykaz-page">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={kickerCls}>Pro majitele</div>
          <h1 className="m-0 text-[24px] leading-[1.2] font-extrabold text-ink">Výkaz práce</h1>
          <div className={`${hintCls} mt-1`}>
            Na konci pracovního dne napište, kolik hodin jste pracovala a na čem. Včas = do 10:00 dalšího dne. Výkaz čte jen majitel.
            Rozepsaný výkaz zůstane uložený v tomto prohlížeči — vyplňujte průběžně, večer stiskněte Odeslat.
          </div>
        </div>
        {/* s247: push — nové úkoly, připomenutí výkazu, bloky ke schválení */}
        <NotificationButton popup="down-end" menuItem className={`${btnNeutralCls} inline-flex items-center !px-3`} />
      </div>

      {!data ? (
        <div className="py-12 text-center text-[13px] font-semibold">
          {loading ? <span className="text-ink-faint">Načítání…</span> : <Notice error={error} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-3.5 items-start">
          <div className="min-w-0 order-2 md:order-1">
            <section className={cardPadCls} data-testid="vykaz-day" data-date={date}>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h2 className="m-0 text-[17px] font-extrabold text-ink">{dayTitle(date)}</h2>
                {dayState && DAY_STATE_LABEL[dayState] && !showForm && (
                  <span className="text-[12.5px] font-semibold text-ink-soft">{DAY_STATE_LABEL[dayState]}</span>
                )}
              </div>
              <Notice error={error} ok={ok} />

              {showForm ? (
                <Form
                  data={data}
                  draft={draft}
                  dayOff={dayOff}
                  reason={reason}
                  saving={saving}
                  editing={editing}
                  prevPlan={prevPlan}
                  onDayOff={setDayOff}
                  onReason={setReason}
                  onUpdate={update}
                  onItem={setItem}
                  onInsertPlan={insertPlan}
                  taskTitles={Object.fromEntries((report?.taskNotes ?? []).map((n) => [n.taskId, n.title]))}
                  onSave={() => void save()}
                  onCancel={() => setEditing(false)}
                />
              ) : report ? (
                <div className="flex flex-col gap-3.5">
                  <ReportStatusLine report={report} />
                  <ReportContentView content={report} categories={data.categories} dayOffReasons={data.dayOffReasons} />
                  <HistoryList report={report} categories={data.categories} dayOffReasons={data.dayOffReasons} />
                  {inWindow ? (
                    <div>
                      <button type="button" className={btnNeutralCls} onClick={startEdit}>
                        Upravit
                      </button>
                      {report.reviewedAt && (
                        <div className={`${hintCls} mt-1.5`}>Majitel výkaz už četl — předchozí verze zůstane uložená.</div>
                      )}
                    </div>
                  ) : (
                    <div className={hintCls}>Tento den už nelze upravit (nejvýš {data.backfillDays} dní zpětně).</div>
                  )}
                  <div>
                    <div className={labelCls}>Komentáře</div>
                    <CommentThread comments={report.comments} onSend={sendComment} placeholder="Odpovědět majiteli…" />
                  </div>
                </div>
              ) : (
                <div className={hintCls}>
                  {date > data.today
                    ? 'Tento den ještě nenastal.'
                    : date < data.since
                      ? `Výkazy se vedou od ${fmtCsDate(data.since)}.`
                      : `Výkaz za tento den už nelze doplnit (nejvýš ${data.backfillDays} dní zpětně).`}
                </div>
              )}

              {data.month === date.slice(0, 7) && date >= data.since && date <= data.today && (
                <div className="mt-4">
                  <SystemFactsStrip key={date} byDay={data.facts} date={date} snapshot={report?.systemFacts} />
                </div>
              )}
            </section>

            <MyTasks reloadKey={tasksKey} focus={boot.current?.task ?? null} />
          </div>

          <aside className="min-w-0 order-1 md:order-2">
            <section className={cardPadCls}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <button type="button" className={iconBtnCls} disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Předchozí měsíc">
                  ‹
                </button>
                <div className="text-[14px] font-extrabold text-ink" data-testid="vykaz-month">
                  {monthLabelCs(month)}
                </div>
                <button type="button" className={iconBtnCls} disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Další měsíc">
                  ›
                </button>
              </div>
              <MonthGrid
                days={data.month === month ? data.days : []}
                selected={date}
                onPick={pickDay}
                canPick={(d) => d.state !== 'future' && d.state !== 'before'}
              />
              {data.month === month && (
                <div className={`${hintCls} mt-3`} data-testid="vykaz-summary">
                  Odevzdáno {data.summary.submitted} z {data.summary.expected} očekávaných · {fmtHours(data.summary.hours)}
                  {data.summary.missing > 0 && ` · chybí ${data.summary.missing}`}
                  {data.summary.avgRating != null && ` · průměrné hodnocení ${String(data.summary.avgRating).replace('.', ',')}`}
                </div>
              )}
            </section>
            {data.month === month && <MonthCategories summary={data.summary} testId="vykaz-categories" />}
          </aside>
        </div>
      )}
    </div>
  )
}

function Form({
  data,
  draft,
  dayOff,
  reason,
  saving,
  editing,
  prevPlan,
  onDayOff,
  onReason,
  onUpdate,
  onItem,
  onInsertPlan,
  onSave,
  onCancel,
  taskTitles,
}: {
  data: MyReports
  draft: Draft
  dayOff: boolean
  reason: string
  saving: boolean
  editing: boolean
  prevPlan: WorkReport | null
  onDayOff: (v: boolean) => void
  onReason: (v: string) => void
  onUpdate: (p: Partial<Draft>) => void
  onItem: (i: number, p: Partial<ReportItem>) => void
  onInsertPlan: () => void
  onSave: () => void
  onCancel: () => void
  /** названия поручений из уже поданного отчёта (если поручение больше не в работе) */
  taskTitles: Record<string, string>
}) {
  const filled = draft.items.some((i) => i.text.trim()) && draft.done.trim() && draft.hours.trim()
  return (
    <div className="flex flex-col gap-4" data-testid="vykaz-form">
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Typ dne">
        <button type="button" className={dayOff ? btnNeutralCls : btnPinkCls} onClick={() => onDayOff(false)} aria-pressed={!dayOff}>
          Pracovala jsem
        </button>
        <button type="button" className={dayOff ? btnPinkCls : btnNeutralCls} onClick={() => onDayOff(true)} aria-pressed={dayOff}>
          Nepracovní den
        </button>
      </div>

      {dayOff ? (
        <label className="block">
          <span className={labelCls}>Důvod</span>
          <select className={`${selectCls} w-full`} value={reason} onChange={(e) => onReason(e.target.value)} data-testid="dayoff-reason">
            <option value="">— vyberte —</option>
            {data.dayOffReasons.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="block max-w-[180px]">
            <span className={labelCls}>Odpracováno hodin *</span>
            <input
              className={`${inputCls} w-full`}
              inputMode="decimal"
              placeholder="např. 7,5"
              value={draft.hours}
              onChange={(e) => onUpdate({ hours: e.target.value })}
              data-testid="hours-input"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <span className={`${labelCls} !mb-0`}>Na čem jsem pracovala *</span>
              {prevPlan && (
                <button type="button" className="text-[12.5px] font-bold text-brand-dark hover:underline" onClick={onInsertPlan} data-testid="insert-plan">
                  Vložit plán z {fmtCsDate(prevPlan.date)}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {draft.items.map((it, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-1.5 sm:items-start" data-testid="item-row">
                  <select
                    className={`${selectCls} sm:w-[190px] shrink-0`}
                    value={it.category}
                    onChange={(e) => onItem(i, { category: e.target.value })}
                    aria-label="Kategorie"
                  >
                    {data.categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5 flex-1 min-w-0">
                    <textarea
                      className={`${textAreaCls} min-w-0`}
                      rows={1}
                      maxLength={500}
                      placeholder="Co konkrétně…"
                      value={it.text}
                      onChange={(e) => onItem(i, { text: e.target.value })}
                    />
                    {draft.items.length > 1 && (
                      <button
                        type="button"
                        className={iconBtnCls}
                        aria-label="Odebrat bod"
                        onClick={() => onUpdate({ items: draft.items.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {draft.items.length < 20 && (
              <button
                type="button"
                className="mt-2 text-[12.5px] font-bold text-brand-dark hover:underline"
                onClick={() => onUpdate({ items: [...draft.items, { ...EMPTY_ITEM }] })}
                data-testid="add-item"
              >
                + Přidat bod
              </button>
            )}
          </div>

          <Area label="Co je hotovo / výsledek *" value={draft.done} onChange={(v) => onUpdate({ done: v })} testId="done" />
          <Area label="Nestihla jsem / přesouvám" value={draft.carried} onChange={(v) => onUpdate({ carried: v })} />
          <Area
            label="Potřebuji rozhodnutí majitele"
            value={draft.needsOwner}
            onChange={(v) => onUpdate({ needsOwner: v })}
            hint="Majitel to uvidí hned na stránce «Сегодня»."
          />
          <Area label="Plán na zítra" value={draft.planTomorrow} onChange={(v) => onUpdate({ planTomorrow: v })} />
          <TasksBlock data={data} draft={draft} titles={taskTitles} onUpdate={onUpdate} />
        </>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          className={btnPinkCls}
          disabled={saving || (dayOff ? !reason : !filled)}
          onClick={onSave}
          data-testid="save-report"
        >
          {saving ? 'Ukládám…' : dayOff ? 'Uložit' : editing ? 'Uložit změny' : 'Odeslat výkaz'}
        </button>
        {editing && (
          <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
            Zrušit
          </button>
        )}
        {!dayOff && !filled && <span className={hintCls}>* povinné: hodiny, aspoň jeden bod a co je hotovo</span>}
      </div>
    </div>
  )
}

function Area({
  label,
  value,
  onChange,
  hint,
  testId,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  testId?: string
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea className={textAreaCls} rows={2} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      {hint && <span className={`${hintCls} block mt-1`}>{hint}</span>}
    </label>
  )
}

/**
 * «Moje úkoly» в форме: по каждому поручению — «hotovo» и/или пара слов о ходе; у ждущего владельца —
 * снять «hotovo» (s245). s246: и свои задачи (бейдж «můj», «hotovo» их сразу закрывает); задачи
 * владельцу сюда не приходят (сервер, `openFor`).
 */
function TasksBlock({
  data,
  draft,
  titles,
  onUpdate,
}: {
  data: MyReports
  draft: Draft
  titles: Record<string, string>
  onUpdate: (p: Partial<Draft>) => void
}) {
  const open = data.openTasks ?? []
  // поручение из уже поданного отчёта, которое больше не в работе, — тоже показать
  const extra = Object.keys(titles)
    .filter((id) => !open.some((t) => t.documentId === id))
    .map((id) => ({ documentId: id, title: titles[id], dueDate: null, priority: 'normal' as const, status: 'accepted' as const, overdue: false }))
  const list = [...open, ...extra]
  if (!list.length) return null
  const set = (id: string, patch: Partial<TaskDraft>) => {
    const cur = draft.tasks[id] ?? { done: false, note: '' }
    onUpdate({ tasks: { ...draft.tasks, [id]: { ...cur, ...patch } } })
  }
  return (
    <div data-testid="report-task-block">
      <div className={labelCls}>Moje úkoly</div>
      <div className={`${hintCls} mb-2`}>
        Co se dnes u úkolu udělalo — zapíše se i do úkolu. «Hotovo» pošle úkol od majitele k převzetí, vlastní úkol uzavře.
      </div>
      <div className="flex flex-col gap-2.5">
        {list.map((t) => {
          const v = draft.tasks[t.documentId] ?? { done: false, note: '' }
          // ждёт владельца: галочка стоит (из статуса), пока её не сняли в этой форме
          const waiting = t.status === 'done'
          const checked = waiting ? !v.undone : v.done
          return (
            <div key={t.documentId} className="rounded-lg border border-line-soft px-3 py-2.5" data-report-task={t.documentId}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-ink break-words min-w-0">{t.title}</span>
                <TaskBadges task={t} origin={'own' in t && t.own ? 'můj' : null} />
              </div>
              <textarea
                className={`${textAreaCls} mt-2`}
                rows={1}
                maxLength={2000}
                placeholder="Průběh dnes…"
                value={v.note}
                onChange={(e) => set(t.documentId, { note: e.target.value })}
              />
              {t.status === 'open' || waiting ? (
                <label className="mt-1.5 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      waiting
                        ? set(t.documentId, { done: false, undone: !e.target.checked })
                        : set(t.documentId, { done: e.target.checked, undone: false })
                    }
                    data-task-waiting={waiting ? '1' : undefined}
                  />
                  Hotovo
                </label>
              ) : (
                // поручение уже принято или отменено — отметку из отчёта не поменять, только написать ещё
                v.done && <div className="mt-1.5 text-[12.5px] font-semibold text-ink-soft">Odesláno jako hotové</div>
              )}
              {waiting && (
                <div className={`${hintCls} mt-1`}>
                  {checked ? 'Odškrtnutím se úkol vrátí do práce (majitel ho ještě nepřevzal).' : 'Po odeslání se úkol vrátí do práce.'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
