import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  badgePosCls,
  btnNeutralCls,
  btnPinkCls,
  cardCls,
  hintCls,
  iconBtnCls,
  inputCls,
  pillCls,
  selectCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import { dateToStr } from '../fetch/masterLoad'
import {
  getScheduleGaps,
  DEAD_MAX,
  DEAD_MIN,
  type MasterGapsRow,
} from '../fetch/scheduleGaps'
import {
  getWindowFillCandidates,
  sendCrossSellOffers,
  getOfferResults,
  BUCKET_LABEL,
  type CrossSellCandidate,
  type SendResult,
  type OfferResultsSummary,
} from '../fetch/windowCrossSell'

const startOfWeek = (d: Date): Date => {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  res.setDate(res.getDate() - ((res.getDay() + 6) % 7))
  return res
}

const addDays = (d: Date, n: number): Date => {
  const res = new Date(d)
  res.setDate(res.getDate() + n)
  return res
}

const fmtShort = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`

const fmtH = (min: number) => `${Math.round((min / 60) * 10) / 10} ч`

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const fmtDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} ${DOW_RU[new Date(y, m - 1, d).getDay()]}`
}

// Нейтральный серый чип (напр. «нет» / «отправлено»)
const neutralChipCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-[#8b857f] bg-[#f6f4f2]'

type Mode = 'month' | 'week'

export default function GapsTab() {
  const now = new Date()
  const [mode, setMode] = useState<Mode>('week')
  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [rows, setRows] = useState<MasterGapsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Дозапись в конкретное окно (клик по чипу окна)
  const [fill, setFill] = useState<{
    employeeId: string
    name: string
    date: string
    start: string
    end: string
  } | null>(null)
  const [fillCands, setFillCands] = useState<CrossSellCandidate[]>([])
  const [fillLoading, setFillLoading] = useState(false)
  const [fillSel, setFillSel] = useState<Set<string>>(new Set())
  const [fillChoice, setFillChoice] = useState<Record<string, string>>({}) // key → serviceId
  const [fillSending, setFillSending] = useState(false)
  const [fillResult, setFillResult] = useState<SendResult | null>(null)
  const [discount, setDiscount] = useState('15 %')
  const [results, setResults] = useState<OfferResultsSummary | null>(null)

  const loadResults = useCallback(async () => {
    try {
      setResults(await getOfferResults())
    } catch {
      setResults(null)
    }
  }, [])
  useEffect(() => {
    loadResults()
  }, [loadResults])

  const openFill = useCallback(
    async (employeeId: string, name: string, date: string, start: string, end: string) => {
      setFill({ employeeId, name, date, start, end })
      setFillCands([])
      setFillSel(new Set())
      setFillResult(null)
      setFillLoading(true)
      try {
        const data = await getWindowFillCandidates(employeeId, name, date, start, end)
        setFillCands(data)
        setFillSel(new Set(data.filter((c) => !c.alreadySent).map((c) => c.key)))
        setFillChoice(Object.fromEntries(data.map((c) => [c.key, c.serviceId])))
      } catch {
        setFillCands([])
      } finally {
        setFillLoading(false)
      }
    },
    [],
  )

  const fillSelected = fillCands.filter((c) => fillSel.has(c.key) && !c.alreadySent)
  // Окно юниора → предлагаем junior-ногти (−20% уже в цене + скидка за дозапись)
  const isJuniorFill = fillCands.some((c) => c.isJunior)
  const toggleFill = (key: string) =>
    setFillSel((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const doFillSend = async () => {
    if (!fill || fillSelected.length === 0) return
    setFillSending(true)
    try {
      // подставляем выбранную в выпадашке услугу
      const toSend = fillSelected.map((c) => {
        const opt = c.serviceOptions?.find((o) => o.serviceId === fillChoice[c.key])
        return opt
          ? {
              ...c,
              serviceId: opt.serviceId,
              serviceTitle: opt.serviceTitle,
              serviceDurationMin: opt.serviceDurationMin,
              offerBucket: opt.offerBucket,
              bookingUrl: opt.bookingUrl,
            }
          : c
      })
      const r = await sendCrossSellOffers(toSend, discount)
      setFillResult(r)
      const data = await getWindowFillCandidates(fill.employeeId, fill.name, fill.date, fill.start, fill.end)
      setFillCands(data)
      setFillSel(new Set())
      loadResults() // обновить статистику

    } catch {
      setFillResult({ total: fillSelected.length, successful: 0, failed: fillSelected.length })
    } finally {
      setFillSending(false)
    }
  }

  const weekEnd = addDays(weekStart, 6)
  const isCurrentWeek = dateToStr(weekStart) === dateToStr(startOfWeek(now))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fromStr =
        mode === 'month'
          ? dateToStr(new Date(year, month, 1))
          : dateToStr(weekStart)
      const toStr =
        mode === 'month'
          ? dateToStr(new Date(year, month + 1, 0))
          : dateToStr(addDays(weekStart, 6))
      const data = await getScheduleGaps(fromStr, toStr)
      setRows(data.sort((a, b) => b.deadMin - a.deadMin))
    } catch {
      setRows([])
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [mode, month, year, weekStart])

  useEffect(() => {
    load()
  }, [load])

  const modeBtn = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)} className={pillCls(mode === m)}>
      {label}
    </button>
  )

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {modeBtn('month', 'Месяц')}
            {modeBtn('week', 'Неделя')}
          </div>
          {mode === 'month' ? (
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className={`${iconBtnCls} text-[16px]`}
                aria-label="Предыдущая неделя"
              >
                ‹
              </button>
              <span className="text-[13px] font-bold text-[#4c4844] whitespace-nowrap min-w-[150px] text-center">
                {fmtShort(weekStart)} – {fmtShort(weekEnd)}.{weekEnd.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className={`${iconBtnCls} text-[16px]`}
                aria-label="Следующая неделя"
              >
                ›
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                  className={btnNeutralCls}
                >
                  Текущая
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <StatSection title="Окна в расписании" id="schedule-gaps" defaultOpen>
        <p className={`m-0 mb-4 ${hintCls}`}>
          Мёртвое окно = свободные {DEAD_MIN}–{DEAD_MAX} мин между бронями — в них трудно продать
          услугу. Зелёные окна (больше {DEAD_MAX} мин) ещё продаваемы.
        </p>
        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">Načítání…</div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#d61f61]">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">
            Нет данных за неделю.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <Cell title="Мастер" asHeader />
                  <Cell title="Занято" asHeader />
                  <Cell title="Свободно" asHeader />
                  <Cell title="Мёртвых окон" asHeader />
                  <Cell title="Мёртвое время" asHeader />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <MasterRow
                    key={r.employeeId}
                    row={r}
                    expanded={expanded === r.employeeId}
                    onToggle={() => setExpanded(expanded === r.employeeId ? null : r.employeeId)}
                    onGapClick={openFill}
                  />
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>

      {results && results.sent > 0 && (
        <StatSection title="Результаты дозаписей" id="window-offer-results" defaultOpen={false}>
          <p className={`m-0 mb-4 ${hintCls}`}>
            Отправлено: <b>{results.sent}</b> · записалось:{' '}
            <b className="text-[#e71e6e]">{results.converted}</b> ({results.pct}%). Конверсия —
            приблизительно (бронь к предложенному мастеру в день предложения или позже); точная
            отметка — в комментарии брони.
          </p>
          <TableWrapper>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <Cell title="Клиент" asHeader />
                  <Cell title="Отправлено" asHeader />
                  <Cell title="Предложено" asHeader />
                  <Cell title="Скидка" asHeader />
                  <Cell title="Статус" asHeader />
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r) => (
                  <tr key={r.log.documentId} className="hover:bg-[#faf8f7] transition-colors">
                    <Cell title={r.log.customerName || '—'} className="font-bold text-[#161615]" />
                    <Cell title={r.log.sentAt ? fmtDay(r.log.sentAt.slice(0, 10)) : '—'} />
                    <Cell
                      title={`${r.log.serviceTitle} · ${r.log.masterName}`}
                      className="text-[#6f6a66]"
                    />
                    <Cell title={r.log.discount || '—'} />
                    <td className="p-4 border-b border-[#f2efec]">
                      {r.converted ? (
                        <span className={`whitespace-nowrap ${badgePosCls}`}>
                          записался{r.bookingDate ? ` · ${fmtDay(r.bookingDate)}` : ''}
                        </span>
                      ) : (
                        <span className={neutralChipCls}>нет</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </StatSection>
      )}

      {fill && (
        <div className="fixed inset-0 z-50 bg-[rgba(22,22,21,0.45)] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#eee9e6] shadow-[0_10px_28px_rgba(22,22,21,0.14)] w-full max-w-4xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#161615] flex items-center gap-2">
                  {isJuniorFill ? 'Дозапись к юниору' : 'Дозапись в окно'}
                  {isJuniorFill && (
                    <span className="text-[11px] font-bold text-[#7c5cd6] bg-[#efe9fb] rounded-md px-[7px] py-0.5">
                      junior −20% в цене
                    </span>
                  )}
                </h3>
                <p className="text-[13px] font-semibold text-[#6f6a66] mt-0.5">
                  {fill.name} · {fmtDay(fill.date)} · окно {fill.start}–{fill.end}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFill(null)}
                className="w-8 h-8 rounded-lg border-0 bg-transparent text-[#a39e99] text-[22px] leading-none hover:bg-[#f6f4f2] hover:text-[#161615] transition-colors inline-flex items-center justify-center shrink-0"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <label className="flex items-center gap-2 text-[13px] font-bold text-[#4c4844]">
                {isJuniorFill ? 'Скидка за дозапись:' : 'Скидка:'}
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={`${inputCls} w-[90px]`}
                />
              </label>
              {isJuniorFill && (
                <span className="text-[12px] font-semibold text-[#7c5cd6]">
                  −20% уже в цене junior + {discount} за дозапись
                </span>
              )}
              <button
                type="button"
                disabled={fillSelected.length === 0 || fillSending}
                onClick={doFillSend}
                className={`ml-auto ${btnPinkCls}`}
              >
                {fillSending ? 'Отправка…' : `Отправить (${fillSelected.length})`}
              </button>
            </div>

            {fillResult && (
              <div className="mb-4 rounded-lg bg-[#e8f6ee] text-[#1d7a3f] text-[13px] font-semibold px-4 py-2.5">
                Отправлено: {fillResult.successful} из {fillResult.total}
                {fillResult.failed > 0 && (
                  <span className="text-[#c53030]"> · ошибок: {fillResult.failed}</span>
                )}
              </div>
            )}

            {fillLoading ? (
              <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">Načítání…</div>
            ) : fillCands.length === 0 ? (
              <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">
                Нет клиентов, чья процедура заканчивается прямо перед этим окном.
              </div>
            ) : (
              <ul className="border border-[#eee9e6] rounded-lg divide-y divide-[#f2efec]">
                {fillCands.map((c) => (
                  <li
                    key={c.key}
                    className={`flex items-start gap-3 px-3 py-2.5 ${c.alreadySent ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 accent-[#e71e6e]"
                      checked={fillSel.has(c.key) && !c.alreadySent}
                      disabled={c.alreadySent}
                      onChange={() => toggleFill(c.key)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-bold text-[#161615]">{c.customerName}</span>
                        <span className="text-[11.5px] font-semibold text-[#a39e99]">{c.email}</span>
                        {c.alreadySent && <span className={neutralChipCls}>отправлено</span>}
                      </div>
                      <div className="text-[12px] font-semibold text-[#6f6a66] mt-1">
                        Её запись: {BUCKET_LABEL[c.anchorBucket]} до {c.anchorEndHHMM} · дозапись в{' '}
                        {c.windowStartHHMM}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                        <span className="text-[12px] font-semibold text-[#8b857f] shrink-0">
                          Предложить:
                        </span>
                        <select
                          value={fillChoice[c.key] ?? c.serviceId}
                          disabled={c.alreadySent}
                          onChange={(e) =>
                            setFillChoice((prev) => ({ ...prev, [c.key]: e.target.value }))
                          }
                          className={`${selectCls} flex-1 min-w-0`}
                        >
                          {(c.serviceOptions ?? []).map((o) => (
                            <option key={o.serviceId} value={o.serviceId}>
                              {o.isJunior ? 'Junior' : BUCKET_LABEL[o.offerBucket]} — {o.serviceTitle}{' '}
                              ({o.serviceDurationMin} мин)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MasterRow({
  row,
  expanded,
  onToggle,
  onGapClick,
}: {
  row: MasterGapsRow
  expanded: boolean
  onToggle: () => void
  onGapClick: (employeeId: string, name: string, date: string, start: string, end: string) => void
}) {
  return (
    <>
      <tr className="hover:bg-[#faf8f7] transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-[#f2efec]">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-[#161615]">
            <span className="text-[#e71e6e]">{expanded ? '−' : '+'}</span>
            {row.name}
          </span>
        </td>
        <Cell title={fmtH(row.bookedMin)} />
        <Cell title={fmtH(row.freeMin)} />
        <Cell
          title={String(row.deadCount)}
          className={row.deadCount > 0 ? 'text-[#c53030] font-bold' : ''}
        />
        <Cell title={row.deadMin ? fmtH(row.deadMin) : '—'} />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-[#f2efec] bg-[#faf9f8]">
            <div className="p-4">
              {row.days.length === 0 ? (
                <div className="text-[13px] font-semibold text-[#a39e99]">
                  Нет рабочих дней на этой неделе.
                </div>
              ) : (
                <div className={`${cardCls} overflow-x-auto`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <Cell title="День" asHeader />
                        <Cell title="Занято" asHeader />
                        <Cell title="Свободно" asHeader />
                        <Cell title="Мёртвых" asHeader />
                        <Cell title="Окна" asHeader />
                      </tr>
                    </thead>
                    <tbody>
                      {row.days.map((d) => (
                        <tr key={d.date} className="hover:bg-[#faf8f7] transition-colors">
                          <Cell title={fmtDay(d.date)} className="font-bold text-[#161615]" />
                          <Cell title={fmtH(d.bookedMin)} />
                          <Cell title={d.freeMin ? fmtH(d.freeMin) : '—'} />
                          <Cell
                            title={d.deadCount ? String(d.deadCount) : '—'}
                            className={d.deadCount ? 'text-[#c53030] font-bold' : ''}
                          />
                          <td className="p-4 border-b border-[#f2efec]">
                            {d.gaps.length === 0 ? (
                              <span className="text-[12px] font-bold text-[#1d7a3f]">
                                без окон — день забит
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                {d.gaps.map((g) => (
                                  <button
                                    type="button"
                                    key={`${d.date}-${g.start}`}
                                    onClick={() =>
                                      onGapClick(row.employeeId, row.name, d.date, g.start, g.end)
                                    }
                                    className={`rounded-lg px-2.5 py-1 text-[12px] font-bold hover:opacity-80 transition-opacity border ${
                                      g.dead
                                        ? 'bg-[#fdecec] text-[#c53030] border-[#f3c1c1]'
                                        : 'bg-[#e8f6ee] text-[#1d7a3f] border-[#bfe4cd]'
                                    }`}
                                    title="Найти клиента для дозаписи в это окно"
                                  >
                                    {g.start}–{g.end} ({g.durationMin} мин)
                                  </button>
                                ))}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
