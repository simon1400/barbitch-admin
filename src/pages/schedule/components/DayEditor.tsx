// Изменение выбранных дней одного мастера. Руководство сохраняет сразу
// (исключение из шаблона), администратор — отправляет предложение на
// согласование: до решения руководства календарь и сайт не меняются.
// Брони, которые окажутся в нерабочем времени, подгружаются заранее —
// блок их не отменяет, их переносят в календаре.
import { useEffect, useMemo, useState } from 'react'

import { btnDangerCls, btnNeutralCls, btnPinkCls, cardPadCls, cardTitleCls, hintCls, inputCls, labelCls, pillCls, selectCls } from '../../../ui/kit'
import { DOW_RU_SHORT, dowOfYmd } from '../../../utils/date'
import { ConflictList } from '../../global/team/tabs/timeoff/ConflictList'
import {
  HOUR_OPTIONS,
  dayWords,
  fmtMin,
  previewDays,
  type Conflict,
  type DayChange,
  type DayState,
  type GridMaster,
} from '../fetch/schedule'

type Choice = DayState | 'template'

interface Props {
  master: GridMaster
  dates: string[]
  canManage: boolean
  busy: boolean
  onSave: (changes: DayChange[], note: string) => void
  onDecide: (date: string, status: 'approved' | 'rejected') => void
  onClear: () => void
}

const CHOICES: Array<[Choice, string]> = [
  ['on', 'Весь день'],
  ['hours', 'Часы'],
  ['off', 'Выходной'],
  ['template', 'Как в шаблоне'],
]

const dm = (d: string) => `${DOW_RU_SHORT[dowOfYmd(d)]} ${d.slice(8, 10)}.${d.slice(5, 7)}`

export function DayEditor({ master, dates, canManage, busy, onSave, onDecide, onClear }: Props) {
  // стартовое значение — день первой выбранной даты
  const first = master.days[dates[0]]
  const [choice, setChoice] = useState<Choice>(first?.state ?? 'on')
  const [from, setFrom] = useState<number>(first?.state === 'hours' && first.from != null ? first.from : 720)
  const [to, setTo] = useState<number>(first?.state === 'hours' && first.to != null ? first.to : 1140)
  const [note, setNote] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const hoursValid = choice !== 'hours' || to > from
  const changes: DayChange[] = useMemo(
    () => dates.map((date) => (choice === 'hours' ? { date, state: choice, from, to } : { date, state: choice })),
    [dates, choice, from, to],
  )
  const key = JSON.stringify(changes)

  // брони в новом нерабочем времени; поздний ответ по старому выбору не показывается
  useEffect(() => {
    if (!hoursValid || choice === 'on') {
      setConflicts([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      previewDays(master.documentId, JSON.parse(key) as DayChange[])
        .then((r) => alive && setConflicts(r.conflicts || []))
        .catch(() => alive && setConflicts([]))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [master.documentId, key, hoursValid, choice])

  const requests = dates.map((d) => [d, master.days[d]?.request] as const).filter(([, r]) => !!r)

  return (
    <div className={cardPadCls} data-testid="day-editor">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cardTitleCls}>{master.name}</h3>
          <div className="mt-1 text-[12.5px] font-semibold text-ink-body" data-testid="editor-dates">
            {dates.map(dm).join(', ')}
          </div>
        </div>
        <button type="button" className={btnNeutralCls} onClick={onClear}>
          Снять выбор
        </button>
      </div>

      {requests.length > 0 && (
        <div className="mt-3 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5" data-testid="editor-requests">
          <div className="text-[12.5px] font-bold text-warn">Предложения администраторов</div>
          <ul className="m-0 mt-1.5 list-none space-y-1.5 p-0">
            {requests.map(([d, r]) => (
              <li key={d} className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-body">
                <span>
                  <b>{dm(d)}</b> — {dayWords(r!)}
                  {r!.by ? ` · ${r!.by}` : ''}
                  {r!.note ? ` · «${r!.note}»` : ''}
                </span>
                {canManage && (
                  <span className="flex gap-1.5">
                    <button type="button" className={btnPinkCls} disabled={busy} onClick={() => onDecide(d, 'approved')}>
                      Согласовать
                    </button>
                    <button type="button" className={btnDangerCls} disabled={busy} onClick={() => onDecide(d, 'rejected')}>
                      Отклонить
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="День">
        {CHOICES.map(([c, label]) => (
          <button key={c} type="button" role="radio" aria-checked={choice === c} className={pillCls(choice === c)} onClick={() => setChoice(c)}>
            {label}
          </button>
        ))}
      </div>

      {choice === 'hours' && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label>
            <span className={labelCls}>С</span>
            <select className={selectCls} value={from} onChange={(e) => setFrom(Number(e.target.value))} data-testid="hours-from">
              {HOUR_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>До</span>
            <select className={selectCls} value={to} onChange={(e) => setTo(Number(e.target.value))} data-testid="hours-to">
              {HOUR_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </select>
          </label>
          {!hoursValid && <span className="text-[12px] font-semibold text-neg">Конец раньше начала</span>}
        </div>
      )}

      <label className="mt-3 block">
        <span className={labelCls}>Заметка</span>
        <input className={inputCls + ' w-full'} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="замена, школа, врач…" />
      </label>

      <ConflictList rows={conflicts} title="Эти записи окажутся в нерабочем времени — блок их не отменит, перенесите в календаре:" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnPinkCls}
          disabled={busy || !hoursValid}
          onClick={() => onSave(changes, note)}
          data-testid="editor-save"
        >
          {canManage ? 'Сохранить' : 'Отправить на согласование'}
        </button>
        {!canManage && (
          <span className={hintCls}>Изменение вступит в силу после согласования управляющей или владельца.</span>
        )}
      </div>
    </div>
  )
}
