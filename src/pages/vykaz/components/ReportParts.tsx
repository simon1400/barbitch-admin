// Общие кирпичи «Výkaz práce» (s239): сетка месяца, просмотр отчёта, история правок,
// нить комментариев, оценка. Их рисуют и страница управляющей (/vykaz), и вкладка
// владельца «Výkazy» — один и тот же отчёт обе стороны видят одинаково.
import { useState } from 'react'

import { badgeMutedCls, badgeNegCls, badgePosCls, badgeWarnCls, btnNeutralCls, hintCls, inputCls, labelCls } from '../../../ui/kit'
import { WEEKDAYS_CS, dowOfYmd, fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import {
  DAY_STATE_LABEL,
  LATE_LABEL,
  fmtHours,
  labelOf,
  type DayState,
  type Labeled,
  type ReportComment,
  type ReportContent,
  type ReportDay,
  type WorkReport,
} from '../fetch/workReports'

// ── сетка месяца ─────────────────────────────────────────────────────────────

const CELL: Record<DayState, string> = {
  on_time: 'bg-pos-bg text-pos',
  late: 'bg-warn-bg text-warn',
  day_off: 'bg-surface-input text-ink-soft',
  time_off: 'bg-surface-input text-ink-soft',
  weekend: 'text-ink-faint',
  open: 'border border-dashed border-brand-line text-brand-dark',
  missing: 'bg-neg-bg text-neg',
  future: 'text-ink-disabled',
  before: 'text-ink-disabled',
}

const MARK: Partial<Record<DayState, string>> = {
  on_time: '✓',
  late: '⏰',
  day_off: '–',
  time_off: '🏖',
  missing: '✕',
}

const LEGEND: DayState[] = ['on_time', 'late', 'open', 'missing', 'day_off', 'time_off']

/** Месяц как календарь (Po…Ne). Клик — по дням, которые `canPick` разрешает. */
export function MonthGrid({
  days,
  selected,
  onPick,
  canPick,
}: {
  days: ReportDay[]
  selected: string | null
  onPick: (date: string) => void
  canPick: (d: ReportDay) => boolean
}) {
  if (!days.length) return null
  // понедельник — первый столбец
  const lead = (dowOfYmd(days[0].date) + 6) % 7
  return (
    <div data-testid="month-grid">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="text-center text-[10.5px] font-bold uppercase tracking-[.06em] text-ink-faint">
            {WEEKDAYS_CS[d]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead${i}`} />
        ))}
        {days.map((d) => {
          const pick = canPick(d)
          const on = d.date === selected
          return (
            <button
              key={d.date}
              type="button"
              data-day={d.date}
              data-state={d.state}
              disabled={!pick}
              onClick={() => onPick(d.date)}
              title={DAY_STATE_LABEL[d.state] || undefined}
              className={`h-11 rounded-lg flex flex-col items-center justify-center leading-none text-[13px] font-bold transition-shadow ${CELL[d.state]} ${
                on ? 'ring-2 ring-brand' : ''
              } ${pick ? 'cursor-pointer hover:ring-2 hover:ring-brand-line' : 'cursor-default'}`}
            >
              <span>{Number(d.date.slice(8, 10))}</span>
              {MARK[d.state] && <span className="text-[10px] mt-0.5">{MARK[d.state]}</span>}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-soft">
            <span className={`w-3.5 h-3.5 rounded inline-flex items-center justify-center text-[9px] ${CELL[s]}`}>{MARK[s]}</span>
            {DAY_STATE_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── значки ───────────────────────────────────────────────────────────────────

export function LateBadge({ late }: { late: WorkReport['late'] }) {
  if (!late) return null
  const cls = late === 'on_time' ? badgePosCls : badgeWarnCls
  return <span className={`${cls} whitespace-nowrap`}>{LATE_LABEL[late]}</span>
}

/** Звёзды оценки: только показ или выбор (повторный клик по текущей — снять). */
export function Rating({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange?: (v: number | null) => void
  disabled?: boolean
}) {
  if (!onChange) {
    if (value == null) return null
    return (
      <span className="text-star text-[14px] tracking-[1px] whitespace-nowrap" aria-label={`hodnocení ${value} z 5`} data-rating={value}>
        {'★'.repeat(value)}
        <span className="text-ink-disabled">{'★'.repeat(5 - value)}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label="Hodnocení dne" data-rating={value ?? ''}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} z 5`}
          aria-pressed={value != null && n <= value}
          onClick={() => onChange(value === n ? null : n)}
          className={`w-8 h-8 text-[20px] leading-none rounded-md hover:bg-surface-hover disabled:opacity-50 ${
            value != null && n <= value ? 'text-star' : 'text-ink-disabled'
          }`}
        >
          ★
        </button>
      ))}
    </span>
  )
}

// ── содержимое отчёта ─────────────────────────────────────────────────────────

function Block({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  if (!text.trim()) return null
  return (
    <div className={accent ? 'rounded-lg bg-warn-bg px-3 py-2' : ''}>
      <div className={labelCls}>{label}</div>
      <div className="text-[14px] font-semibold text-ink-body whitespace-pre-wrap break-words">{text}</div>
    </div>
  )
}

/** Содержимое отчёта (или «nepracovní den»). */
export function ReportContentView({
  content,
  categories,
  dayOffReasons,
}: {
  content: ReportContent
  categories: Labeled[]
  dayOffReasons: Labeled[]
}) {
  if (content.status === 'day_off') {
    return (
      <div className="text-[14px] font-semibold text-ink-body">
        Nepracovní den · <b className="text-ink">{labelOf(dayOffReasons, content.dayOffReason)}</b>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3" data-testid="report-content">
      <div className="text-[14px] font-semibold text-ink-body">
        Odpracováno: <b className="text-ink">{fmtHours(content.hours)}</b>
      </div>
      <div>
        <div className={labelCls}>Na čem jsem pracovala</div>
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
          {content.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px] font-semibold text-ink-body">
              <span className={`${badgeMutedCls} whitespace-nowrap mt-0.5`}>{labelOf(categories, it.category)}</span>
              <span className="min-w-0 whitespace-pre-wrap break-words">{it.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <Block label="Co je hotovo" text={content.done} />
      <Block label="Nestihla jsem / přesouvám" text={content.carried} />
      <Block label="Potřebuji rozhodnutí majitele" text={content.needsOwner} accent />
      <Block label="Plán na zítra" text={content.planTomorrow} />
    </div>
  )
}

const stamp = (iso: string | null | undefined): string =>
  iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '—'

/** Шапка отчёта: когда подан, опоздание, правки, прочтение и оценка. */
export function ReportStatusLine({ report }: { report: WorkReport }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[12.5px] font-semibold text-ink-soft" data-testid="report-status">
      {report.status === 'submitted' && report.submittedAt && <span>Odevzdáno {stamp(report.submittedAt)}</span>}
      <LateBadge late={report.status === 'submitted' ? report.late : null} />
      {report.editedAfterReview && <span className={`${badgeWarnCls} whitespace-nowrap`}>upraveno po přečtení</span>}
      {report.reviewedAt ? (
        <span className={`${badgePosCls} whitespace-nowrap`} data-reviewed>
          přečteno {stamp(report.reviewedAt)}
        </span>
      ) : (
        report.status === 'submitted' && <span className={`${badgeMutedCls} whitespace-nowrap`}>nepřečteno</span>
      )}
      <Rating value={report.rating} />
    </div>
  )
}

/** Прежние версии (правки после прочтения). */
export function HistoryList({
  report,
  categories,
  dayOffReasons,
}: {
  report: WorkReport
  categories: Labeled[]
  dayOffReasons: Labeled[]
}) {
  const [open, setOpen] = useState(false)
  if (!report.history.length) return null
  return (
    <div data-testid="report-history">
      <button type="button" className="text-[12.5px] font-bold text-brand-dark hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? 'Skrýt předchozí verze' : `Předchozí verze (${report.history.length})`}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3">
          {[...report.history].reverse().map((h, i) => (
            <div key={i} className="rounded-lg border border-line-soft px-3 py-2.5">
              <div className={`${hintCls} mb-1.5`}>Verze před úpravou {stamp(h.at)}</div>
              <ReportContentView content={h.snapshot} categories={categories} dayOffReasons={dayOffReasons} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = { owner: 'majitel', manager: 'manažerka' }

/** Нить комментариев + поле ответа. */
export function CommentThread({
  comments,
  onSend,
  busy,
  placeholder = 'Napsat komentář…',
}: {
  comments: ReportComment[]
  onSend?: (text: string) => Promise<boolean>
  busy?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const send = async () => {
    if (!onSend || !text.trim()) return
    if (await onSend(text.trim())) setText('')
  }
  return (
    <div className="flex flex-col gap-2" data-testid="comments">
      {comments.map((c, i) => (
        <div
          key={i}
          data-comment-role={c.role}
          className={`rounded-lg px-3 py-2 ${c.role === 'owner' ? 'bg-brand-tint' : 'bg-surface-input'}`}
        >
          <div className="text-[11.5px] font-bold text-ink-soft">
            {c.authorName} · {ROLE_LABEL[c.role] ?? c.role} · {stamp(c.at)}
          </div>
          <div className="text-[14px] font-semibold text-ink-body whitespace-pre-wrap break-words">{c.text}</div>
        </div>
      ))}
      {onSend && (
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={1000}
            className={`${inputCls} w-full min-w-0 flex-1 resize-y`}
            data-testid="comment-input"
          />
          <button type="button" className={btnNeutralCls} disabled={busy || !text.trim()} onClick={() => void send()}>
            Odeslat
          </button>
        </div>
      )}
    </div>
  )
}

/** Ошибка/успех строкой. */
export function Notice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) {
    return (
      <div role="alert" className={`${badgeNegCls} !text-[12.5px] !px-3 !py-2 block mb-3`}>
        {error}
      </div>
    )
  }
  if (ok) {
    return (
      <div role="status" className={`${badgePosCls} !text-[12.5px] !px-3 !py-2 block mb-3`}>
        {ok}
      </div>
    )
  }
  return null
}
