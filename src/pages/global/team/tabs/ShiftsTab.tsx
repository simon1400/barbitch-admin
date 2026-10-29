import { useEffect, useState } from 'react'
import { addDaysYmd, fmtCsShort, todayYmd, ymdToDate } from '../../../../utils/date'
import { btnNeutralCls, hintCls, iconBtnCls, mutedCls, toolbarCardCls } from '../../../../ui/kit'
import {
  EMPTY_DAYS,
  WINDOW_WEEKS,
  cleanName,
  defaultWindowStart,
  deleteShiftWeek,
  fetchShiftWindow,
  isDirty,
  isWeekLocked,
  mergeNames,
  saveShiftWeek,
  DAY_KEYS,
  type ShiftWeek,
  type ShiftsLang,
  type WeekDays,
} from '../fetch/shifts'
import { WeekCard } from './shifts/WeekCard'
import { SHIFTS_TEXT } from './shifts/texts'
import { RefreshButton } from '../../../../components/RefreshButton'

const short = (ymd: string) => fmtCsShort(ymdToDate(ymd))
const clean = (d: WeekDays): WeekDays =>
  Object.fromEntries(DAY_KEYS.map((k) => [k, cleanName(d[k])])) as WeekDays
const emptyWeek = (w: ShiftWeek): ShiftWeek => ({
  ...w,
  documentId: null,
  days: null,
  published: false,
  updatedAt: null,
  duplicate: false,
})

// «Смены администраторов» (s217, Фаза E плана «Управляющая»): график недели
// «кто дежурит» вместо Strapi CM. Тот же график показывают плашка календаря,
// «Сегодня» и отчёт дозаписей.
// s278: тот же экран по-чешски для администраторок (`lang='cs'`, `administrator`) —
// вкладка «Rozpis směn» в «Směna»: прошлые недели только для чтения (сервер:
// `week_locked`), удаления недели нет.
export default function ShiftsTab({ lang = 'ru', administrator = false }: { lang?: ShiftsLang; administrator?: boolean }) {
  const t = SHIFTS_TEXT[lang]
  const today = todayYmd()
  const [start, setStart] = useState(() => defaultWindowStart(today))
  const [reload, setReload] = useState(0)
  const [weeks, setWeeks] = useState<ShiftWeek[]>([])
  const [before, setBefore] = useState<ShiftWeek | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, WeekDays>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(null)
    fetchShiftWindow(start, WINDOW_WEEKS, lang)
      .then((res) => {
        if (!alive) return
        setWeeks(res.weeks)
        setBefore(res.before)
        setNames(res.names)
        setDrafts(Object.fromEntries(res.weeks.map((w) => [w.monday, { ...(w.days ?? EMPTY_DAYS) }])))
        setErrors({})
        setNotes({})
      })
      .catch((e: Error) => {
        if (!alive) return
        setWeeks([])
        setLoadError(e.message || t.loadError)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [start, reload, lang, t.loadError])

  const dirtyCount = weeks.filter((w) => drafts[w.monday] && isDirty(w.days, drafts[w.monday])).length
  const leave = (next: () => void) => {
    if (dirtyCount && !window.confirm(t.confirmLeave)) return
    next()
  }

  const setNote = (monday: string, text: string | null) => {
    setNotes((p) => ({ ...p, [monday]: text ?? '' }))
    setErrors((p) => ({ ...p, [monday]: '' }))
  }
  const replaceWeek = (w: ShiftWeek) => setWeeks((prev) => prev.map((x) => (x.monday === w.monday ? w : x)))

  const edit = (monday: string, days: WeekDays) => {
    setDrafts((p) => ({ ...p, [monday]: days }))
    setNote(monday, null)
  }

  const save = async (w: ShiftWeek) => {
    const days = clean(drafts[w.monday])
    setBusy(w.monday)
    setNote(w.monday, null)
    try {
      const res = await saveShiftWeek(w.monday, days, w.updatedAt, lang)
      replaceWeek(res.week)
      setDrafts((p) => ({ ...p, [w.monday]: { ...(res.week.days ?? days) } }))
      setNames((p) => mergeNames(p, res.week.days))
      setNote(w.monday, res.unchanged ? t.noteUnchanged : t.noteSaved)
    } catch (e) {
      setErrors((p) => ({ ...p, [w.monday]: (e as Error).message }))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (w: ShiftWeek) => {
    if (!window.confirm(t.confirmDelete(`${short(w.monday)} – ${short(w.sunday)}`))) return
    setBusy(w.monday)
    setNote(w.monday, null)
    try {
      await deleteShiftWeek(w.monday, w.updatedAt, lang)
      replaceWeek(emptyWeek(w))
      setDrafts((p) => ({ ...p, [w.monday]: { ...EMPTY_DAYS } }))
      setNote(w.monday, t.noteDeleted)
    } catch (e) {
      setErrors((p) => ({ ...p, [w.monday]: (e as Error).message }))
    } finally {
      setBusy(null)
    }
  }

  const last = addDaysYmd(start, 7 * (WINDOW_WEEKS - 1) + 6)
  const home = defaultWindowStart(today)

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={iconBtnCls}
            aria-label={t.prev}
            onClick={() => leave(() => setStart(addDaysYmd(start, -7 * WINDOW_WEEKS)))}
          >
            ‹
          </button>
          <span className="text-[13.5px] font-bold text-ink whitespace-nowrap" data-testid="shifts-range">
            {short(start)} – {short(last)}
          </span>
          <button
            type="button"
            className={iconBtnCls}
            aria-label={t.next}
            onClick={() => leave(() => setStart(addDaysYmd(start, 7 * WINDOW_WEEKS)))}
          >
            ›
          </button>
          {start !== home && (
            <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => leave(() => setStart(home))}>
              {t.thisWeek}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirtyCount > 0 && <span className="text-[12.5px] font-semibold text-warn">{t.dirtyWeeks(dirtyCount)}</span>}
          <RefreshButton onClick={() => leave(() => setReload((n) => n + 1))} lang={lang} />
        </div>
      </div>

      <p className={`${hintCls} mb-3.5`}>{administrator ? t.hintAdministrator : t.hint}</p>

      {loading ? (
        <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">{t.loading}</div>
      ) : loadError ? (
        <div role="alert" className="py-12 text-center text-[13px] font-semibold text-neg">
          {loadError}
        </div>
      ) : (
        weeks.map((w, i) => {
          const prev = i === 0 ? before?.days ?? null : drafts[weeks[i - 1].monday] ?? null
          return (
            <WeekCard
              key={w.monday}
              week={w}
              draft={drafts[w.monday] ?? EMPTY_DAYS}
              prev={prev}
              names={names}
              today={today}
              busy={busy === w.monday}
              error={errors[w.monday] || null}
              note={notes[w.monday] || null}
              t={t}
              locked={isWeekLocked(administrator, w.monday, today)}
              canDelete={!administrator}
              onChange={(k, v) => edit(w.monday, { ...(drafts[w.monday] ?? EMPTY_DAYS), [k]: v })}
              onCopyPrev={() => prev && edit(w.monday, { ...prev })}
              onReset={() => edit(w.monday, { ...(w.days ?? EMPTY_DAYS) })}
              onSave={() => save(w)}
              onDelete={() => remove(w)}
            />
          )
        })
      )}
      {!loading && !loadError && <div className={`${mutedCls} mt-1`}>{t.allDays}</div>}
    </>
  )
}
