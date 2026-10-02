// Вкладка «Výkazy» модуля «Команда» (s239) — только владелец: отчёты управляющей за месяц.
//
// Сетка дней (подан / поздно / нет / volno / отпуск), итог месяца, список отчётов:
// раскрыть → текст, прежние версии, «Označit jako přečtené», оценка 1–5, комментарий.
// s240: под отчётом — «Systém zaznamenal»; день без отчёта, где журналы что-то записали,
// тоже открывается из сетки; итог месяца по категориям пунктов.
// Ссылки с «Сегодня» приходят как ?personal=&date= — месяц и отчёт открываются сами.
// Поздний ответ другого месяца/человека в экран не ложится (номер запроса + проверка).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  badgeWarnCls,
  btnNeutralCls,
  cardPadCls,
  hintCls,
  iconBtnCls,
  labelCls,
  pillCls,
  selectCls,
  tileCls,
  tileLabelCls,
  tileSubCls,
  tileValueCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import { WEEKDAYS_CS, dowOfYmd, fmtCsDate, todayYmd } from '../../../../utils/date'
import { ApiError } from '../../../../lib/apiFetch'
import {
  CommentThread,
  HistoryList,
  LateBadge,
  MonthCategories,
  MonthGrid,
  Notice,
  Rating,
  ReportContentView,
  ReportStatusLine,
  SystemFactsStrip,
} from '../../../vykaz/components/ReportParts'
import {
  DAY_STATE_LABEL,
  fetchReportsList,
  fmtHours,
  labelOf,
  monthLabelCs,
  reviewReport,
  shiftMonth,
  type ReportsList,
  type WorkReport,
} from '../../../vykaz/fetch/workReports'

const fresh = (r: WorkReport) => r.status === 'submitted' && (!r.reviewedAt || r.editedAfterReview)

export default function ReportsTab() {
  const [params] = useSearchParams()
  const linkDate = params.get('date') || ''
  const [month, setMonth] = useState(() => (/^\d{4}-\d{2}/.test(linkDate) ? linkDate.slice(0, 7) : todayYmd().slice(0, 7)))
  const [personal, setPersonal] = useState<string | null>(params.get('personal'))
  const [data, setData] = useState<ReportsList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [open, setOpen] = useState<string | null>(linkDate || null)
  const [busy, setBusy] = useState<string | null>(null)
  const seq = useRef(0)

  // keepError — перечитать после действия (итог месяца) или 409, не стирая текст ошибки
  const load = useCallback(async (m: string, p: string | null, keepError = false) => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await fetchReportsList(m, p)
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
    void load(month, personal)
  }, [load, month, personal])

  // отметка/оценка/комментарий: ответ — одна строка, заменяем её на месте; итог месяца
  // (непрочитанные, средняя оценка) считает сервер — месяц тихо перечитывается
  const act = async (r: WorkReport, body: { seen?: true; rating?: number | null; comment?: string }) => {
    setBusy(r.documentId)
    setError(null)
    try {
      const res = await reviewReport(r.documentId, body)
      setData((d) =>
        d ? { ...d, reports: d.reports.map((x) => (x.documentId === res.saved.documentId ? res.saved : x)) } : d,
      )
      void load(month, personal)
      return true
    } catch (e) {
      setError((e as Error).message)
      if (e instanceof ApiError && e.code === 'report_changed') void load(month, personal, true)
      return false
    } finally {
      setBusy(null)
    }
  }

  const monthReports = data
    ? data.reports
        .filter((r) => r.date.startsWith(data.month))
        .filter((r) => !onlyUnread || fresh(r))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : []
  const s = data?.summary
  const shown = data && data.month === month
  // выбранный в сетке день без отчёта (журналы что-то записали) — карточка над списком
  const bareDay =
    shown && open && open.startsWith(data.month) && !data.reports.some((r) => r.date === open)
      ? (data.days.find((d) => d.date === open) ?? null)
      : null

  return (
    <div data-testid="reports-tab">
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2">
          <button type="button" className={iconBtnCls} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Předchozí měsíc">
            ‹
          </button>
          <div className="text-[14px] font-extrabold text-ink min-w-[120px] text-center" data-testid="reports-month">
            {monthLabelCs(month)}
          </div>
          <button
            type="button"
            className={iconBtnCls}
            disabled={month >= todayYmd().slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Další měsíc"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && data.people.length > 1 && (
            <select
              className={selectCls}
              value={data.personal ?? ''}
              onChange={(e) => {
                setPersonal(e.target.value)
                setOpen(null)
              }}
              aria-label="Zaměstnanec"
            >
              {data.people.map((p) => (
                <option key={p.documentId} value={p.documentId}>
                  {p.name}
                  {p.isActive ? '' : ' (už nepracuje)'}
                </option>
              ))}
            </select>
          )}
          <button type="button" className={pillCls(onlyUnread)} onClick={() => setOnlyUnread((v) => !v)} aria-pressed={onlyUnread}>
            Jen nepřečtené{s && s.unread > 0 ? ` (${s.unread})` : ''}
          </button>
        </div>
      </div>

      <Notice error={error} />

      {!data ? (
        <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">{loading ? 'Načítání…' : ''}</div>
      ) : !data.personal ? (
        <div className={`${cardPadCls} ${hintCls}`}>
          Žádná karta s pozicí «manager» — výkazy se zatím nevedou.
        </div>
      ) : (
        <>
          {shown && s && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3.5" data-testid="reports-summary">
              <Tile label="Odevzdáno" value={`${s.submitted} / ${s.expected}`} sub="z očekávaných dnů" />
              <Tile label="Včas" value={String(s.onTime)} sub={`pozdě ${s.late} · včas = do 10:00 dalšího dne`} />
              <Tile label="Chybí" value={String(s.missing)} sub={`volno ${s.dayOff} · dovolená ${s.timeOff}`} warn={s.missing > 0} />
              <Tile label="Hodin" value={fmtHours(s.hours)} sub="součet za měsíc" />
              <Tile label="Hodnocení" value={s.avgRating == null ? '—' : String(s.avgRating).replace('.', ',')} sub="průměr 1–5" />
              <Tile label="Nepřečteno" value={String(s.unread)} sub="nové nebo upravené" warn={s.unread > 0} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-3.5 items-start">
            <div className="min-w-0">
              <section className={cardPadCls}>
                <MonthGrid
                  days={shown ? data.days : []}
                  selected={open}
                  onPick={(d) => setOpen(d)}
                  canPick={(d) => !!d.reportId || !!data.facts?.[d.date]}
                />
              </section>
              {shown && s && <MonthCategories summary={s} testId="reports-categories" />}
            </div>

            <div className="min-w-0 flex flex-col gap-2.5" data-testid="reports-list">
              {bareDay && (
                <section className={`${cardPadCls} !mb-0`} data-bare-day={bareDay.date}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[15px] font-extrabold text-ink">
                        {WEEKDAYS_CS[dowOfYmd(bareDay.date)]} {fmtCsDate(bareDay.date)}
                      </div>
                      <div className="text-[12.5px] font-semibold text-ink-soft mt-0.5">
                        Bez výkazu{DAY_STATE_LABEL[bareDay.state] ? ` · ${DAY_STATE_LABEL[bareDay.state]}` : ''}
                      </div>
                    </div>
                    <button type="button" className={iconBtnCls} onClick={() => setOpen(null)} aria-label="Zavřít">
                      ×
                    </button>
                  </div>
                  <SystemFactsStrip key={bareDay.date} byDay={data.facts} date={bareDay.date} />
                </section>
              )}
              {shown && monthReports.length === 0 && (
                <div className={`${cardPadCls} ${hintCls}`}>
                  {onlyUnread ? 'Všechny výkazy měsíce jsou přečtené.' : 'Za tento měsíc zatím žádný výkaz.'}
                </div>
              )}
              {shown &&
                monthReports.map((r) => (
                  <ReportRow
                    key={r.documentId}
                    report={r}
                    data={data}
                    open={open === r.date}
                    busy={busy === r.documentId}
                    onToggle={() => setOpen(open === r.date ? null : r.date)}
                    onAct={(body) => act(r, body)}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={tileCls}>
      <div className={tileLabelCls}>{label}</div>
      <div className={`${tileValueCls} ${warn ? '!text-warn' : ''}`}>{value}</div>
      <div className={tileSubCls}>{sub}</div>
    </div>
  )
}

function ReportRow({
  report: r,
  data,
  open,
  busy,
  onToggle,
  onAct,
}: {
  report: WorkReport
  data: ReportsList
  open: boolean
  busy: boolean
  onToggle: () => void
  onAct: (body: { seen?: true; rating?: number | null; comment?: string }) => Promise<boolean>
}) {
  const unread = fresh(r)
  return (
    <section
      className={`${cardPadCls} !mb-0 ${unread ? '!border-warn-line' : ''}`}
      data-report={r.date}
      data-unread={unread ? '1' : undefined}
    >
      <button type="button" className="w-full text-left flex items-start gap-3" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-ink">
            {WEEKDAYS_CS[dowOfYmd(r.date)]} {fmtCsDate(r.date)}
            {unread && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-warn align-middle" aria-label="nepřečteno" />}
          </span>
          <span className="block text-[12.5px] font-semibold text-ink-soft mt-0.5">
            {r.status === 'day_off'
              ? `nepracovní den · ${labelOf(data.dayOffReasons, r.dayOffReason)}`
              : `${fmtHours(r.hours)} · bodů ${r.items.length}${r.needsOwner.trim() ? ' · ❓ potřebuje rozhodnutí' : ''}`}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
          {r.status === 'submitted' && <LateBadge late={r.late} />}
          {r.editedAfterReview && <span className={`${badgeWarnCls} whitespace-nowrap`}>upraveno</span>}
          <Rating value={r.rating} />
          <span className="text-ink-faint text-[14px]">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="mt-3.5 pt-3.5 border-t border-line-soft flex flex-col gap-3.5">
          <ReportStatusLine report={r} />
          <ReportContentView content={r} categories={data.categories} dayOffReasons={data.dayOffReasons} />
          <HistoryList report={r} categories={data.categories} dayOffReasons={data.dayOffReasons} />
          <SystemFactsStrip byDay={data.facts} date={r.date} snapshot={r.systemFacts} />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className={btnNeutralCls}
              disabled={busy || (!!r.reviewedAt && !r.editedAfterReview)}
              onClick={() => void onAct({ seen: true })}
              data-testid="mark-read"
            >
              {r.reviewedAt && !r.editedAfterReview ? 'Přečteno ✓' : 'Označit jako přečtené'}
            </button>
            <span className="inline-flex items-center gap-2">
              <span className={`${labelCls} !mb-0`}>Hodnocení dne</span>
              <Rating value={r.rating} disabled={busy} onChange={(v) => void onAct({ rating: v })} />
            </span>
          </div>
          <div>
            <div className={labelCls}>Komentáře</div>
            <CommentThread
              comments={r.comments}
              busy={busy}
              onSend={(text) => onAct({ comment: text })}
              placeholder="Komentář pro manažerku (výkaz se tím označí jako přečtený)…"
            />
          </div>
        </div>
      )}
    </section>
  )
}
