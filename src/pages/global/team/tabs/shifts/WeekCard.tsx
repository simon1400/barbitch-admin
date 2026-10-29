import { useState } from 'react'
import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  btnDangerCls,
  btnNeutralCls,
  btnPinkCls,
  cardCls,
  cardTitleCls,
  rowInputCls,
} from '../../../../../ui/kit'
import { fmtCsShort, ymdToDate } from '../../../../../utils/date'
import {
  DAY_KEYS,
  MAX_NAME,
  cleanName,
  isComplete,
  isDirty,
  weekDates,
  type DayKey,
  type ShiftWeek,
  type WeekDays,
} from '../../fetch/shifts'
import type { ShiftsText } from './texts'

const OTHER = '__other'
const short = (ymd: string) => fmtCsShort(ymdToDate(ymd))

/** Поле дня: выбор из недавних имён или свой текст («Другое…»). */
function DayField({
  day,
  value,
  names,
  invalid,
  disabled,
  t,
  onChange,
}: {
  day: DayKey
  value: string
  names: string[]
  invalid: boolean
  disabled: boolean
  t: ShiftsText
  onChange: (v: string) => void
}) {
  const [custom, setCustom] = useState(false)
  const typed = custom || (cleanName(value) !== '' && !names.includes(cleanName(value)))
  const ring = invalid ? '!border-warn' : ''

  if (typed) {
    return (
      <span className="flex gap-1">
        <input
          name={day}
          className={`${rowInputCls} ${ring} w-full min-w-0`}
          value={value}
          maxLength={MAX_NAME}
          placeholder={t.placeholder}
          autoFocus={custom}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {!disabled && (
          <button
            type="button"
            className="shrink-0 px-1.5 rounded-md text-[12px] font-bold text-ink-muted hover:text-ink disabled:opacity-50"
            title={t.pickFromList}
            aria-label={t.pickFromList}
            onClick={() => {
              setCustom(false)
              onChange('')
            }}
          >
            ▾
          </button>
        )}
      </span>
    )
  }

  return (
    <select
      name={day}
      className={`${rowInputCls} ${ring} w-full min-w-0 cursor-pointer`}
      value={cleanName(value)}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setCustom(true)
          onChange('')
        } else onChange(e.target.value)
      }}
    >
      <option value="">—</option>
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
      <option value={OTHER}>{t.other}</option>
    </select>
  )
}

/**
 * Неделя графика: 7 дней, сохранить / отменить / как прошлая неделя / удалить.
 * s278: `locked` — неделя только для чтения (администраторке прошлые недели не
 * даёт сервер), `canDelete` — кнопка удаления (только руководству).
 */
export function WeekCard({
  week,
  draft,
  prev,
  names,
  today,
  busy,
  error,
  note,
  t,
  locked = false,
  canDelete = true,
  onChange,
  onCopyPrev,
  onReset,
  onSave,
  onDelete,
}: {
  week: ShiftWeek
  draft: WeekDays
  /** дни предыдущей недели (как видны на экране) — источник копирования */
  prev: WeekDays | null
  names: string[]
  today: string
  busy: boolean
  error: string | null
  note: string | null
  t: ShiftsText
  locked?: boolean
  canDelete?: boolean
  onChange: (day: DayKey, v: string) => void
  onCopyPrev: () => void
  onReset: () => void
  onSave: () => void
  onDelete: () => void
}) {
  const dates = weekDates(week.monday)
  const dirty = isDirty(week.days, draft)
  const complete = isComplete(draft)
  const current = week.monday <= today && today <= week.sunday
  const past = week.sunday < today
  // неопубликованную неделю из CM можно опубликовать и без правок
  const pending = week.documentId !== null && !week.published
  const canSave = !busy && !week.duplicate && complete && (dirty || pending)
  const canCopy = !busy && prev !== null && isComplete(prev) && isDirty(prev, draft)

  return (
    <section
      className={`${cardCls} px-4 sm:px-5 py-4 mb-3 ${current ? 'ring-2 ring-brand-line' : ''}`}
      data-week={week.monday}
      data-dirty={dirty || undefined}
      data-locked={locked || undefined}
    >
      <header className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className={cardTitleCls}>
          {short(week.monday)} – {short(week.sunday)}
        </h2>
        {current && <span className={badgePosCls}>{t.badgeCurrent}</span>}
        {past && <span className={badgeMutedCls}>{t.badgePast}</span>}
        {locked && <span className={badgeMutedCls}>{t.badgeLocked}</span>}
        {week.documentId === null && <span className={badgeWarnCls}>{t.badgeNone}</span>}
        {week.documentId !== null && !week.published && !locked && (
          <span className={badgeMutedCls} title={t.badgeUnpublishedTitle}>
            {t.badgeUnpublished}
          </span>
        )}
        {week.duplicate && <span className={badgeNegCls}>{t.badgeDuplicate}</span>}
        {dirty && <span className={badgeWarnCls}>{t.badgeDirty}</span>}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {DAY_KEYS.map((k) => {
          const isToday = dates[k] === today
          return (
            <label key={k} className="block min-w-0">
              <span
                className={`block mb-1 text-[11px] font-bold tracking-[0.05em] uppercase ${
                  isToday ? 'text-brand-dark' : 'text-ink-soft'
                }`}
              >
                {t.dayLabels[k]} {short(dates[k])}
              </span>
              <DayField
                day={k}
                value={draft[k]}
                names={names}
                invalid={dirty && cleanName(draft[k]) === ''}
                disabled={busy || locked}
                t={t}
                onChange={(v) => onChange(k, v)}
              />
            </label>
          )
        })}
      </div>

      {dirty && !complete && <div className="mt-2 text-[12px] font-normal text-warn">{t.incomplete}</div>}
      {error && (
        <div role="alert" className="mt-2 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}
      {note && !dirty && !error && (
        <div role="status" className="mt-2 text-[12px] font-semibold text-pos">
          {note}
        </div>
      )}

      {!locked && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* кнопка только когда есть что сохранять: выключенная розовая неотличима от включённой */}
          {(dirty || pending || busy) && (
            <button type="button" className={`${btnPinkCls} !px-3 !py-1.5`} disabled={!canSave} onClick={onSave}>
              {busy ? t.saving : t.save}
            </button>
          )}
          {dirty && (
            <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} disabled={busy} onClick={onReset}>
              {t.reset}
            </button>
          )}
          <button
            type="button"
            className={`${btnNeutralCls} !px-3 !py-1.5`}
            disabled={!canCopy}
            title={prev && isComplete(prev) ? t.copyPrevTitle : t.copyPrevNone}
            onClick={onCopyPrev}
          >
            {t.copyPrev}
          </button>
          {canDelete && week.documentId !== null && (
            <button type="button" className={`${btnDangerCls} !px-3 !py-1.5 ml-auto`} disabled={busy} onClick={onDelete}>
              {t.remove}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
