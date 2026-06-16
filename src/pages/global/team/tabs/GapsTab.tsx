import { useState, useEffect, useCallback } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
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
      setError('Не удалось загрузить данные из Noona')
    } finally {
      setLoading(false)
    }
  }, [mode, month, year, weekStart])

  useEffect(() => {
    load()
  }, [load])

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
        mode === m
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap sticky top-0 z-40">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
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
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-sm"
                aria-label="Предыдущая неделя"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[170px] text-center">
                {fmtShort(weekStart)} – {fmtShort(weekEnd)}.{weekEnd.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-sm"
                aria-label="Следующая неделя"
              >
                ›
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 text-xs text-gray-600"
                >
                  Текущая
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <StatSection title="Окна в расписании" id="schedule-gaps" defaultOpen>
        <p className="text-xs text-gray-400 mb-4">
          Мёртвое окно = свободные {DEAD_MIN}–{DEAD_MAX} мин между бронями — в них трудно продать
          услугу. Зелёные окна (больше {DEAD_MAX} мин) ещё продаваемы.
        </p>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-red-600 py-8 text-center">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">Нет данных за неделю.</div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
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
          <p className="text-xs text-gray-400 mb-4">
            Отправлено: <b>{results.sent}</b> · записалось:{' '}
            <b className="text-primary">{results.converted}</b> ({results.pct}%). Конверсия —
            приблизительно (бронь к предложенному мастеру в день предложения или позже); точная
            отметка — в комментарии брони Noona.
          </p>
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
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
                  <tr key={r.log.documentId} className="hover:bg-gray-50 transition-colors">
                    <Cell title={r.log.customerName || '—'} className="font-medium" />
                    <Cell title={r.log.sentAt ? fmtDay(r.log.sentAt.slice(0, 10)) : '—'} />
                    <Cell
                      title={`${r.log.serviceTitle} · ${r.log.masterName}`}
                      className="text-gray-600"
                    />
                    <Cell title={r.log.discount || '—'} />
                    <td className="p-4 border-b border-blue-gray-50">
                      {r.converted ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                          записался{r.bookingDate ? ` · ${fmtDay(r.bookingDate)}` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-600">
                          нет
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Дозапись в окно</h3>
                <p className="text-sm text-gray-600">
                  {fill.name} · {fmtDay(fill.date)} · окно {fill.start}–{fill.end}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFill(null)}
                className="text-gray-400 hover:text-gray-700 text-3xl leading-none px-2 shrink-0"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Скидка:
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={fillSelected.length === 0 || fillSending}
                onClick={doFillSend}
                className="ml-auto px-5 py-2 rounded-lg text-sm font-semibold border border-primary bg-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fillSending ? 'Отправка…' : `Отправить (${fillSelected.length})`}
              </button>
            </div>

            {fillResult && (
              <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                Отправлено: {fillResult.successful} из {fillResult.total}
                {fillResult.failed > 0 && (
                  <span className="text-red-600"> · ошибок: {fillResult.failed}</span>
                )}
              </div>
            )}

            {fillLoading ? (
              <div className="text-gray-500 py-8 text-center">Načítání…</div>
            ) : fillCands.length === 0 ? (
              <div className="text-gray-500 py-8 text-center text-sm">
                Нет клиентов, чья процедура заканчивается прямо перед этим окном.
              </div>
            ) : (
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {fillCands.map((c) => (
                  <li
                    key={c.key}
                    className={`flex items-start gap-3 px-3 py-2.5 ${c.alreadySent ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={fillSel.has(c.key) && !c.alreadySent}
                      disabled={c.alreadySent}
                      onChange={() => toggleFill(c.key)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{c.customerName}</span>
                        <span className="text-xs text-gray-400">{c.email}</span>
                        {c.alreadySent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-600">
                            отправлено
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Её запись: {BUCKET_LABEL[c.anchorBucket]} до {c.anchorEndHHMM} · дозапись в{' '}
                        {c.windowStartHHMM}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-gray-500 shrink-0">Предложить:</span>
                        <select
                          value={fillChoice[c.key] ?? c.serviceId}
                          disabled={c.alreadySent}
                          onChange={(e) =>
                            setFillChoice((prev) => ({ ...prev, [c.key]: e.target.value }))
                          }
                          className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 min-w-0"
                        >
                          {(c.serviceOptions ?? []).map((o) => (
                            <option key={o.serviceId} value={o.serviceId}>
                              {BUCKET_LABEL[o.offerBucket]} — {o.serviceTitle} ({o.serviceDurationMin}{' '}
                              мин)
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
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-blue-gray-50">
          <span className="flex items-center gap-2 font-medium text-blue-gray-900">
            <span className="text-primary">{expanded ? '−' : '+'}</span>
            {row.name}
          </span>
        </td>
        <Cell title={fmtH(row.bookedMin)} />
        <Cell title={fmtH(row.freeMin)} />
        <Cell
          title={String(row.deadCount)}
          className={row.deadCount > 0 ? 'text-red-600 font-semibold' : ''}
        />
        <Cell title={row.deadMin ? fmtH(row.deadMin) : '—'} />
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-blue-gray-50 bg-gray-50">
            <div className="p-4">
              {row.days.length === 0 ? (
                <div className="text-sm text-gray-500">Нет рабочих дней на этой неделе.</div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                  <table className="w-full text-left table-auto min-w-max">
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
                        <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                          <Cell title={fmtDay(d.date)} className="font-medium" />
                          <Cell title={fmtH(d.bookedMin)} />
                          <Cell title={d.freeMin ? fmtH(d.freeMin) : '—'} />
                          <Cell
                            title={d.deadCount ? String(d.deadCount) : '—'}
                            className={d.deadCount ? 'text-red-600 font-semibold' : ''}
                          />
                          <td className="p-4 border-b border-blue-gray-50">
                            {d.gaps.length === 0 ? (
                              <span className="text-xs text-green-600 font-medium">
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
                                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-shadow hover:ring-2 hover:ring-primary/40 ${
                                      g.dead
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
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
