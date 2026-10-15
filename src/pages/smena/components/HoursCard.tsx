// «Moje hodiny» модуля «Směna» (s263): своя запись рабочих часов за день — «Od»/«Do» по сетке
// 30 мин (как в панели), часы = конец − начало (считает сервер, здесь — подсказка), «Co jsem
// dělal/a» — текст (сервер кладёт его в HTML, как CKEditor). Чипы типовых задач только
// дописывают текст. Сохранённое — свёрнуто, «Upravit» / «Smazat» (пока смена не закрыта).
// s266 (Фаза 3): с `person` — часы этой администраторки для руководства (любой прошедший день,
// `personal` в теле / адресе); без записи — свёрнуто «Nezapsáno» + «Zapsat hodiny».
import { useState } from 'react'

import { ApiError } from '../../../lib/apiFetch'
import { btnDangerCls, btnNeutralCls, btnPinkCls, cardPadCls, cardTitleCls, chipCls, hintCls, inputCls, labelCls, mutedCls, selectCls } from '../../../ui/kit'
import { WORK_CHIPS, deleteSmenaWorkTime, fmtHours, hoursOf, saveSmenaWorkTime, smenaFieldError, type FieldError, type SmenaDay, type WorkTimeDay } from '../fetch/smena'

const fieldErrCls = 'mt-1 text-[12px] font-semibold text-neg'

export function HoursCard({
  day,
  workTime,
  person,
  onSaved,
  onReload,
}: {
  day: SmenaDay
  /** запись часов (своя — `day.workTime`, у руководства — из `day.others`) */
  workTime: WorkTimeDay | null
  /** s266: чьи часы правит руководство; нет — свои */
  person?: { documentId: string; name: string }
  onSaved: (d: SmenaDay) => void
  onReload: () => void
}) {
  const wt = workTime
  const [editing, setEditing] = useState(!wt && !person)
  const [start, setStart] = useState(wt?.startTime || '10:00')
  const [end, setEnd] = useState(wt?.endTime || '19:00')
  const [comment, setComment] = useState(wt?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<FieldError | null>(null)
  const [stale, setStale] = useState(false)

  const readOnly = !day.editable || !!wt?.closed
  const hours = hoursOf(start, end)

  const fail = (e: unknown) => {
    setErr(smenaFieldError(e))
    setStale(e instanceof ApiError && e.code === 'stale')
  }

  const save = async () => {
    setBusy(true)
    setErr(null)
    setStale(false)
    try {
      const res = await saveSmenaWorkTime(day.date, {
        startTime: start,
        endTime: end,
        comment: comment.trim(),
        expectedUpdatedAt: wt?.updatedAt ?? null,
        ...(person ? { personal: person.documentId } : {}),
      })
      setEditing(false)
      onSaved(res)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(person ? `Smazat hodiny ${person.name} za tento den?` : 'Smazat hodiny za tento den?')) return
    setBusy(true)
    setErr(null)
    try {
      const res = await deleteSmenaWorkTime(day.date, person?.documentId)
      setEditing(!person)
      onSaved(res)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const addChip = (c: string) => {
    if (comment.includes(c)) return
    const t = comment.trim()
    setComment(t ? `${t.replace(/[,.]$/, '')}, ${c}` : c)
  }

  const errFor = (field: string) =>
    err && err.field === field ? (
      <div className={fieldErrCls} data-field-error={field}>
        {err.text}
      </div>
    ) : null
  const generalErr = !!err && !['startTime', 'endTime', 'comment'].includes(err.field ?? '')

  return (
    <section
      className={cardPadCls}
      data-card={person ? 'hodiny-osoba' : 'hodiny'}
      data-testid={person ? 'smena-hodiny-osoba' : 'smena-hodiny'}
      data-person={person?.documentId}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h2 className={cardTitleCls}>{person ? person.name || '—' : 'Moje hodiny'}</h2>
        {wt?.closed && <span className={mutedCls}>Směna uzavřená</span>}
      </div>

      {wt && !editing ? (
        <div data-testid="hodiny-view">
          <div className="text-[16px] font-extrabold text-ink">
            {wt.startTime}–{wt.endTime} · {fmtHours(wt.hours)}
          </div>
          <div className="mt-1 text-[13.5px] text-ink-body whitespace-pre-line break-words">{wt.comment}</div>
          {!readOnly && (
            <div className="flex gap-2 mt-3">
              <button type="button" className={btnNeutralCls} onClick={() => setEditing(true)} data-edit-hours>
                Upravit
              </button>
              <button type="button" className={btnDangerCls} disabled={busy} onClick={() => void remove()} data-delete-hours>
                Smazat
              </button>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <div className={hintCls}>Hodiny za tento den nejsou vyplněné.</div>
      ) : !wt && !editing ? (
        <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="hodiny-empty">
          <span className={hintCls}>Nezapsáno.</span>
          <button type="button" className={btnNeutralCls} onClick={() => setEditing(true)} data-add-hours>
            Zapsat hodiny
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="hodiny-form">
          <div className="flex items-end gap-2.5 flex-wrap">
            <label className="block">
              <span className={labelCls}>Od</span>
              <select className={selectCls} value={start} onChange={(e) => setStart(e.target.value)} data-field="startTime">
                {day.slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Do</span>
              <select className={selectCls} value={end} onChange={(e) => setEnd(e.target.value)} data-field="endTime">
                {day.slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="pb-2 text-[15px] font-extrabold text-ink" data-testid="hodiny-sum">
              {hours != null ? `= ${fmtHours(hours)}` : <span className="text-neg text-[13px]">Konec musí být po začátku</span>}
            </div>
          </div>
          {errFor('startTime')}
          {errFor('endTime')}
          <div className={hintCls}>Celá doba od příchodu do odchodu, bez odečtu přestávky.</div>
          <label className="block">
            <span className={labelCls}>{person ? 'Co dělala' : 'Co jsem dělal/a'}</span>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {WORK_CHIPS.map((c) => (
                <button key={c} type="button" className={chipCls(comment.includes(c))} onClick={() => addChip(c)}>
                  {c}
                </button>
              ))}
            </div>
            <textarea className={`${inputCls} w-full resize-y`} rows={3} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} data-field="comment" />
            {errFor('comment')}
          </label>
          {generalErr && (
            <div className={fieldErrCls} data-field-error="general">
              {err?.text}
            </div>
          )}
          {stale && (
            <button type="button" className={`${btnNeutralCls} self-start`} onClick={onReload}>
              Načíst znovu
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" className={btnPinkCls} disabled={busy || hours == null || comment.trim().length < 3} onClick={() => void save()} data-save="hours">
              {busy ? 'Ukládám…' : 'Uložit hodiny'}
            </button>
            {(wt || person) && (
              <button
                type="button"
                className={btnNeutralCls}
                onClick={() => {
                  setEditing(false)
                  setStart(wt?.startTime || '10:00')
                  setEnd(wt?.endTime || '19:00')
                  setComment(wt?.comment ?? '')
                  setErr(null)
                }}
              >
                Zrušit
              </button>
            )}
          </div>
        </div>
      )}
      {!editing && err && (
        <div className={fieldErrCls} data-field-error="general">
          {err.text}
        </div>
      )}
    </section>
  )
}
