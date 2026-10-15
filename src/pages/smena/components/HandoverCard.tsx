// «Předání směny» во вкладке «Směna» (s265, Фаза 2 плана ADMIN_SHIFT_NEXT_SESSION_PROMPT.md, §0в):
// администраторка в конце смены одной кнопкой оставляет коллеге сообщение, ставит ей задачи и
// передаёт свои незавершённые. Всё делает сервер (`PUT /smena/:date/handover`): задачи — обычные
// задачи s262 (`owner-tasks`), получательнице — один push-сводка. Частичный сбой задачи сообщение
// не роняет — несделанное остаётся в форме, ошибки под кнопкой.
// «Komu» — работающие администраторки без меня; одна — выбрана сразу, иначе последний выбор
// (localStorage). Подсказка «кто следующий по графику» — только текст: имена в графике свободные.
// Отправленное за день — сверху (кому, прочитано или нет); пока не прочитано, повтор правит его.
import { useCallback, useEffect, useRef, useState } from 'react'

import { btnNeutralCls, btnPinkCls, cardPadCls, cardTitleCls, hintCls, inputCls, labelCls, mutedCls, selectCls } from '../../../ui/kit'
import { WEEKDAYS_CS, addDaysYmd, dowOfYmd, fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { fetchTasks, type Task } from '../../vykaz/fetch/tasks'
import { saveHandover, smenaFieldError, type FieldError, type Handover, type HandoverError, type SmenaDay } from '../fetch/smena'

const fieldErrCls = 'mt-1 text-[12px] font-semibold text-neg'
const LAST_TO_KEY = 'smena.handoverTo'

const readLastTo = (): string => {
  try {
    return localStorage.getItem(LAST_TO_KEY) || ''
  } catch {
    return ''
  }
}
const writeLastTo = (v: string) => {
  try {
    localStorage.setItem(LAST_TO_KEY, v)
  } catch {
    /* приватное окно — не страшно */
  }
}

/** «Zítra» / «Pá 17.10.2026» — когда дежурит следующая по графику. */
const dutyDay = (date: string, duty: string) => (duty === addDaysYmd(date, 1) ? 'Zítra' : `${WEEKDAYS_CS[dowOfYmd(duty)]} ${fmtCsDate(duty)}`)

const stamp = (iso: string | null) => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '')

type NewTask = { key: number; title: string; description: string }

/** Отправленное сообщение: кому, когда, прочитано; текст и задачи. */
function SentItem({ h, onEdit }: { h: Handover; onEdit?: () => void }) {
  return (
    <div className="rounded-lg bg-surface-input px-3 py-2.5" data-handover-out={h.documentId} data-read={h.readAt ? '1' : '0'}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="text-[13px] font-bold text-ink">
          → {h.toName || '—'} <span className={mutedCls}>· {stamp(h.updatedAt || h.createdAt)}</span>
        </div>
        <span className={`text-[12px] font-bold ${h.readAt ? 'text-pos' : 'text-ink-faint'}`}>{h.readAt ? `✓ přečteno ${fmtTimePrague(h.readAt)}` : 'zatím nepřečteno'}</span>
      </div>
      {h.text && <div className="mt-1 text-[13.5px] text-ink-body whitespace-pre-line break-words">{h.text}</div>}
      {h.tasks.length > 0 && (
        <ul className="m-0 mt-1.5 p-0 list-none flex flex-col gap-0.5">
          {h.tasks.map((t) => (
            <li key={t.documentId} className="text-[12.5px] font-semibold text-ink-soft">
              {t.kind === 'new' ? '＋ nový úkol' : '↪ předaný'}: {t.title || '—'}
            </li>
          ))}
        </ul>
      )}
      {onEdit && (
        <button type="button" className="mt-1.5 text-[12.5px] font-bold text-brand-dark" onClick={onEdit} data-edit-handover>
          Upravit vzkaz
        </button>
      )}
    </div>
  )
}

export function HandoverCard({ day, reloadKey, onDone }: { day: SmenaDay; reloadKey: number; onDone: (d: SmenaDay) => void }) {
  const colleagues = day.colleagues ?? []
  const sent = day.handoverOut ?? []
  const [to, setTo] = useState(() => {
    if (colleagues.length === 1) return colleagues[0].documentId
    const last = readLastTo()
    return colleagues.some((c) => c.documentId === last) ? last : ''
  })
  const [text, setText] = useState('')
  const [newTasks, setNewTasks] = useState<NewTask[]>([])
  const [mineOpen, setMineOpen] = useState<Task[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<FieldError | null>(null)
  const [partial, setPartial] = useState<HandoverError[]>([])
  const [ok, setOk] = useState<string | null>(null)
  const keySeq = useRef(1)
  const seq = useRef(0)

  // свои незавершённые — задачи на ней в работе (общие «všem» и так у всех)
  const loadMine = useCallback(async () => {
    const my = ++seq.current
    try {
      const res = await fetchTasks('active')
      if (my !== seq.current) return
      setMineOpen(res.tasks.filter((t) => t.forMe && t.status === 'open' && !t.allAdmins))
    } catch {
      if (my === seq.current) setMineOpen([])
    }
  }, [])

  useEffect(() => {
    void loadMine()
  }, [loadMine, reloadKey])

  const pickTo = (v: string) => {
    setTo(v)
    if (v) writeLastTo(v)
  }

  const cleanTasks = newTasks.filter((t) => t.title.trim())
  const nothing = !text.trim() && !cleanTasks.length && !picked.length
  const toName = colleagues.find((c) => c.documentId === to)?.name || ''

  const submit = async () => {
    setBusy(true)
    setErr(null)
    setPartial([])
    setOk(null)
    try {
      const res = await saveHandover(day.date, {
        to,
        text: text.trim(),
        tasks: cleanTasks.map((t) => ({ title: t.title.trim(), description: t.description.trim() })),
        handover: picked,
        note: picked.length ? note.trim() : '',
      })
      // несделанное остаётся в форме
      const failedNew = new Set(res.errors.filter((e) => e.kind === 'new').map((e) => e.index))
      const failedHand = new Set(res.errors.filter((e) => e.kind === 'handover').map((e) => e.id))
      setNewTasks(cleanTasks.filter((_, i) => failedNew.has(i)))
      setPicked(picked.filter((id) => failedHand.has(id)))
      setText('')
      if (!failedHand.size) setNote('')
      setPartial(res.errors)
      const parts = [res.handover.text && 'vzkaz', res.created && `nové úkoly: ${res.created}`, res.handedOver && `předané: ${res.handedOver}`].filter(Boolean)
      setOk(`Předáno ${res.handover.toName}${parts.length ? ` — ${parts.join(', ')}` : ''}. Dostane upozornění.`)
      onDone(res.day)
      void loadMine()
    } catch (e) {
      setErr(smenaFieldError(e))
    } finally {
      setBusy(false)
    }
  }

  const errFor = (field: string, index: number | null = null) =>
    err && err.field === field && (index === null || err.index === index) ? (
      <div className={fieldErrCls} data-field-error={field}>
        {err.text}
      </div>
    ) : null
  const generalErr = !!err && !['to', 'text', 'note', 'tasks.title'].includes(err.field ?? '')

  return (
    <section className={cardPadCls} data-card="predani" data-testid="smena-predani">
      <h2 className={`${cardTitleCls} mb-1`}>Předání směny</h2>
      <div className={`${hintCls} mb-3`}>Vzkaz pro kolegyni na další směnu, úkoly pro ni a předání vašich nedokončených — jedním tlačítkem.</div>

      {sent.length > 0 && (
        <div className="flex flex-col gap-2 mb-3.5" data-testid="predani-sent">
          {sent.map((h) => (
            <SentItem
              key={h.documentId}
              h={h}
              onEdit={
                !h.readAt && day.editable && h.toPersonal && colleagues.some((c) => c.documentId === h.toPersonal)
                  ? () => {
                      pickTo(h.toPersonal || '')
                      setText(h.text)
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {!day.editable ? (
        <div className={hintCls}>Starší den — předávat lze jen za dnešek a {day.backfillDays} dny zpětně.</div>
      ) : colleagues.length === 0 ? (
        <div className={hintCls} data-testid="predani-nobody">
          Není komu předat — jiná administrátorka nemá v systému propojenou kartu. Řekněte vedení.
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="predani-form">
          <label className="block">
            <span className={labelCls}>Komu *</span>
            <select className={selectCls} value={to} onChange={(e) => pickTo(e.target.value)} data-field="to">
              {colleagues.length > 1 && <option value="">— vyberte —</option>}
              {colleagues.map((c) => (
                <option key={c.documentId} value={c.documentId}>
                  {c.name}
                </option>
              ))}
            </select>
            {day.nextDuty && (
              <div className={`${hintCls} mt-1`} data-testid="predani-duty">
                {dutyDay(day.date, day.nextDuty.date)} podle rozpisu: {day.nextDuty.name}
              </div>
            )}
            {errFor('to')}
          </label>

          <label className="block">
            <span className={labelCls}>Vzkaz</span>
            <textarea
              className={`${inputCls} w-full resize-y`}
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Co je potřeba vědět: dodávka, klientka volala, co zbylo…"
              data-field="text"
            />
            {errFor('text')}
          </label>

          <div>
            <div className={labelCls}>Úkoly pro kolegyni</div>
            {newTasks.map((t, i) => (
              <div key={t.key} className="flex flex-col gap-1.5 mb-2 rounded-lg bg-surface-input px-3 py-2.5" data-new-task={i}>
                <div className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} flex-1 min-w-0`}
                    maxLength={200}
                    value={t.title}
                    placeholder="Co je potřeba udělat"
                    onChange={(e) => setNewTasks((ts) => ts.map((x) => (x.key === t.key ? { ...x, title: e.target.value } : x)))}
                    data-field="task-title"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-ink-faint hover:text-neg text-[15px]"
                    aria-label="Odebrat úkol"
                    onClick={() => setNewTasks((ts) => ts.filter((x) => x.key !== t.key))}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className={`${inputCls} w-full resize-y !text-[14px]`}
                  rows={2}
                  maxLength={4000}
                  value={t.description}
                  placeholder="Podrobnosti (nepovinné)"
                  onChange={(e) => setNewTasks((ts) => ts.map((x) => (x.key === t.key ? { ...x, description: e.target.value } : x)))}
                  data-field="task-description"
                />
                {errFor('tasks.title', i)}
              </div>
            ))}
            {newTasks.length < 10 && (
              <button type="button" className={btnNeutralCls} onClick={() => setNewTasks((ts) => [...ts, { key: keySeq.current++, title: '', description: '' }])} data-add-task>
                + Úkol
              </button>
            )}
            <div className={`${hintCls} mt-1`}>Úkol od vás se uzavře, jakmile ho kolegyně označí jako hotový — dostanete upozornění.</div>
          </div>

          <div>
            <div className={labelCls}>Předat moje nedokončené</div>
            {mineOpen === null ? (
              <div className={mutedCls}>Načítání…</div>
            ) : mineOpen.length === 0 ? (
              <div className={hintCls}>Žádné vaše úkoly v práci.</div>
            ) : (
              <div className="flex flex-col gap-1.5" data-testid="predani-mine">
                {mineOpen.map((t) => (
                  <label key={t.documentId} className="flex items-start gap-2 text-[14px] font-semibold text-ink-body cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.includes(t.documentId)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.documentId] : p.filter((x) => x !== t.documentId)))}
                      data-hand-task={t.documentId}
                    />
                    <span className="min-w-0 break-words">
                      {t.title}
                      {t.dueDate ? <span className={mutedCls}> · do {fmtCsDate(t.dueDate)}</span> : null}
                    </span>
                  </label>
                ))}
                {picked.length > 0 && (
                  <label className="block mt-1">
                    <span className={labelCls}>Poznámka k předání</span>
                    <input className={`${inputCls} w-full`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Co je hotovo, co zbývá" data-field="note" />
                    {errFor('note')}
                  </label>
                )}
                <div className={hintCls}>Kdo úkol zadal (majitel, manažerka), uvidí, komu jste ho předala.</div>
              </div>
            )}
          </div>

          {generalErr && (
            <div className={fieldErrCls} data-field-error="general">
              {err?.text}
            </div>
          )}
          {partial.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-0.5" data-testid="predani-errors">
              {partial.map((e, i) => (
                <li key={i} className={fieldErrCls}>
                  {e.kind === 'new' ? `Úkol „${e.title || '—'}“` : `Předání úkolu`}: {e.message}
                </li>
              ))}
            </ul>
          )}
          {ok && (
            <div className="text-[13px] font-bold text-pos" role="status" data-testid="predani-ok">
              ✓ {ok}
            </div>
          )}
          <div>
            <button type="button" className={btnPinkCls} disabled={busy || !to || nothing} onClick={() => void submit()} data-save="handover">
              {busy ? 'Předávám…' : toName ? `Předat směnu — ${toName}` : 'Předat směnu'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
