// Шаблон недели мастера (только руководство): для каждого дня недели —
// выходной, весь день или часы. Действует с выбранной даты; более поздние
// шаблоны новый перекрывает. Исключения по датам остаются важнее шаблона.
import { useEffect, useMemo, useState } from 'react'

import { btnNeutralCls, btnPinkCls, cardPadCls, cardTitleCls, hintCls, inputCls, labelCls, selectCls } from '../../../ui/kit'
import { fmtCsDate } from '../../../utils/date'
import { ConflictList } from '../../global/team/tabs/timeoff/ConflictList'
import {
  DOW_SHORT,
  HOUR_OPTIONS,
  WEEK_ORDER,
  allOnTemplate,
  dayWords,
  fmtMin,
  nextMonday,
  previewTemplate,
  templateFor,
  type Conflict,
  type Day,
  type DayState,
  type GridMaster,
  type TemplateDays,
} from '../fetch/schedule'

interface Props {
  master: GridMaster
  today: string
  busy: boolean
  onSave: (from: string, days: TemplateDays) => void
  onClose: () => void
}

const STATES: Array<[DayState, string]> = [
  ['on', 'весь день'],
  ['hours', 'часы'],
  ['off', 'выходной'],
]

export function TemplateEditor({ master, today, busy, onSave, onClose }: Props) {
  const templates = master.schedule.templates
  // первый шаблон — с сегодняшнего дня (закрыть дыру сразу), смена шаблона — со следующего понедельника
  const [from, setFrom] = useState(templates.length ? nextMonday(today) : today)
  const base = templateFor(templates, from)
  const [days, setDays] = useState<TemplateDays>(() => structuredClone(base?.days ?? allOnTemplate()))
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const valid = from >= today && WEEK_ORDER.every((k) => days[k].state !== 'hours' || (days[k].to ?? 0) > (days[k].from ?? 0))
  const key = useMemo(() => JSON.stringify({ from, days }), [from, days])

  useEffect(() => {
    if (!valid) return
    let alive = true
    const t = setTimeout(() => {
      const q = JSON.parse(key) as { from: string; days: TemplateDays }
      previewTemplate(master.documentId, q.from, q.days)
        .then((r) => alive && setConflicts(r.conflicts || []))
        .catch(() => alive && setConflicts([]))
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [master.documentId, key, valid])

  const setDay = (k: (typeof WEEK_ORDER)[number], d: Day) => setDays((cur) => ({ ...cur, [k]: d }))

  return (
    <div className={cardPadCls} data-testid="template-editor">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cardTitleCls}>Шаблон недели · {master.name}</h3>
          <p className={`${hintCls} m-0 mt-1`}>
            Система сама ставит по шаблону блоки «Volno» / «Mimo směnu» до конца окна записи и продлевает их каждый час.
            Отдельные дни меняются в сетке.
          </p>
        </div>
        <button type="button" className={btnNeutralCls} onClick={onClose}>
          Закрыть
        </button>
      </div>

      <div className="mt-3 grid gap-1.5">
        {WEEK_ORDER.map((k) => {
          const d = days[k]
          return (
            <div key={k} className="flex flex-wrap items-center gap-2" data-dow={k}>
              <span className="w-8 text-[13px] font-extrabold text-ink">{DOW_SHORT[k]}</span>
              <select
                className={selectCls}
                value={d.state}
                aria-label={`${DOW_SHORT[k]}: режим`}
                onChange={(e) => {
                  const s = e.target.value as DayState
                  setDay(k, s === 'hours' ? { state: s, from: d.from ?? 720, to: d.to ?? 1140 } : { state: s })
                }}
              >
                {STATES.map(([s, label]) => (
                  <option key={s} value={s}>
                    {label}
                  </option>
                ))}
              </select>
              {d.state === 'hours' && (
                <>
                  <select
                    className={selectCls}
                    aria-label={`${DOW_SHORT[k]}: с`}
                    value={d.from}
                    onChange={(e) => setDay(k, { ...d, from: Number(e.target.value) })}
                  >
                    {HOUR_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {fmtMin(m)}
                      </option>
                    ))}
                  </select>
                  <span className="text-ink-soft">–</span>
                  <select
                    className={selectCls}
                    aria-label={`${DOW_SHORT[k]}: до`}
                    value={d.to}
                    onChange={(e) => setDay(k, { ...d, to: Number(e.target.value) })}
                  >
                    {HOUR_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {fmtMin(m)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )
        })}
      </div>

      <label className="mt-3 block max-w-[220px]">
        <span className={labelCls}>Действует с</span>
        <input type="date" className={inputCls + ' w-full'} min={today} value={from} onChange={(e) => setFrom(e.target.value)} data-testid="template-from" />
      </label>
      {templates.some((t) => t.from >= from) && (
        <p className="m-0 mt-1.5 text-[12px] font-semibold text-warn" data-testid="template-overrides">
          Заменит шаблон{templates.filter((t) => t.from >= from).length > 1 ? 'ы' : ''} с{' '}
          {templates
            .filter((t) => t.from >= from)
            .map((t) => fmtCsDate(t.from))
            .join(', ')}
          .
        </p>
      )}

      <ConflictList rows={conflicts} title="Эти записи окажутся в нерабочем времени — блок их не отменит, перенесите в календаре:" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btnPinkCls} disabled={busy || !valid} onClick={() => onSave(from, days)} data-testid="template-save">
          Сохранить шаблон
        </button>
        {!valid && <span className="text-[12px] font-semibold text-neg">Проверьте часы и дату начала</span>}
      </div>

      {templates.length > 0 && (
        <div className="mt-4">
          <div className={labelCls}>История шаблонов</div>
          <ul className="m-0 list-none space-y-1 p-0">
            {[...templates].reverse().map((t) => (
              <li key={t.from} className="text-[12px] text-ink-body">
                <b>с {fmtCsDate(t.from)}</b>
                {t.by ? ` · ${t.by}` : ''} — {WEEK_ORDER.map((k) => `${DOW_SHORT[k]} ${dayWords(t.days[k])}`).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
