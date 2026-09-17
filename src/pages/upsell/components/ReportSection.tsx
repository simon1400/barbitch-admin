// «Контроль предложений» — отчёт владельца за месяц (s199).
// Кто из клиентов был в салоне, кому предложили дозапись, чем закончилось, почему
// отказывались или не предлагали, и сколько клиентов осталось без отметки —
// по дням с дежурной администраторкой по графику смен.
import { useState } from 'react'

import { Pagination } from '../../../components/Pagination'
import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  cardCls,
  cardTitleCls,
  colHeadCls,
  headMicroCls,
  hintCls,
  mutedCls,
  pillCls,
  tileCls,
  tileLabelCls,
  tileValueCls,
  tileValueNegCls,
} from '../../../ui/kit'
import { DOW_RU_SHORT, dowOfYmd, fmtCsDate, monthLabelRu } from '../../../utils/date'
import type { UpsellReport, UpsellReportOutcome } from '../fetch/upsellApi'
import { OUTCOME_LABEL, reasonLabel } from '../labels'

const OUTCOME_CLS: Record<UpsellReportOutcome, string> = {
  booked: badgePosCls,
  site: badgeMutedCls,
  declined: badgeNegCls,
  not_offered: badgeWarnCls,
  missing: `${badgeWarnCls} !text-neg`,
}

const FILTERS: (UpsellReportOutcome | 'all')[] = ['all', 'missing', 'declined', 'not_offered', 'booked', 'site']
const PAGE_SIZE = 25

const tileSubCls = 'text-[12px] font-semibold text-ink-muted mt-1'
const cellCls = 'py-2 pr-3 text-[13px] font-semibold text-ink-body align-top'
const numCls = `${cellCls} text-right whitespace-nowrap w-px`
const subTitleCls = `${headMicroCls} text-ink-muted mb-2`
const pct = (n: number, of: number): string => (of > 0 ? `${Math.round((n * 100) / of)} %` : '—')

interface Props {
  month: string
  data: UpsellReport | null
  loading: boolean
  error: string | null
}

export function ReportSection({ month, data, loading, error }: Props) {
  const [filter, setFilter] = useState<UpsellReportOutcome | 'all'>('all')
  const [page, setPage] = useState(1)
  const t = data?.totals
  const rows = (data?.rows || []).filter((r) => filter === 'all' || r.outcome === filter)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const reasonTotal = (outcome: string) => data?.reasons.filter((r) => r.outcome === outcome).reduce((s, r) => s + r.count, 0) || 0

  return (
    <section className={`${cardCls} px-5 pt-[18px] pb-4 mt-4`} data-report>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className={cardTitleCls}>Контроль предложений · {monthLabelRu(month)}</h2>
        <span className={mutedCls}>по клиентам, которые были в салоне</span>
      </div>
      {error && <div className={`${hintCls} text-neg mb-2`}>{error}</div>}
      {loading && !data && <div className={mutedCls}>Загрузка…</div>}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          <div className={tileCls} data-tile="visited">
            <div className={tileLabelCls}>Были в салоне</div>
            <div className={tileValueCls}>{t.visited}</div>
            <div className={tileSubCls}>{t.site > 0 ? `из них ${t.site} дозаписались на сайте` : 'клиентов за месяц'}</div>
          </div>
          <div className={tileCls} data-tile="coverage">
            <div className={tileLabelCls}>Отмечено</div>
            <div className={tileValueCls}>{t.coveragePct != null ? `${t.coveragePct} %` : '—'}</div>
            <div className={tileSubCls}>
              {t.marked} из {t.required}
            </div>
          </div>
          <div className={tileCls} data-tile="booked">
            <div className={tileLabelCls}>Дозаписались</div>
            <div className={`${tileValueCls} !text-pos`}>{t.booked}</div>
            <div className={tileSubCls}>{t.conversionPct != null ? `${t.conversionPct} % от предложенных` : 'предложений не было'}</div>
          </div>
          <div className={tileCls} data-tile="declined">
            <div className={tileLabelCls}>Отказались</div>
            <div className={tileValueCls}>{t.declined}</div>
            <div className={tileSubCls}>предложили — не захотели</div>
          </div>
          <div className={tileCls} data-tile="not-offered">
            <div className={tileLabelCls}>Не предлагали</div>
            <div className={tileValueCls}>{t.notOffered}</div>
            <div className={tileSubCls}>с причиной</div>
          </div>
          <div className={tileCls} data-tile="missing">
            <div className={tileLabelCls}>Не отмечено</div>
            <div className={t.missing > 0 ? tileValueNegCls : tileValueCls}>{t.missing}</div>
            <div className={tileSubCls}>никто не закрыл</div>
          </div>
        </div>
      )}

      {data && data.rows.length === 0 && <div className={`${hintCls} pb-1`}>В этом месяце данных нет.</div>}

      {data && data.rows.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div>
              <div className={subTitleCls}>По администраторам</div>
              {data.byAdmin.length === 0 ? (
                <div className={hintCls}>Отметок пока нет.</div>
              ) : (
                <table className="w-full" data-table="report-admins">
                  <thead>
                    <tr>
                      <th className={`${colHeadCls} text-left pb-1`}>Кто</th>
                      <th className={`${colHeadCls} text-right pb-1`}>Дозапись</th>
                      <th className={`${colHeadCls} text-right pb-1`}>Отказ</th>
                      <th className={`${colHeadCls} text-right pb-1`}>Не предл.</th>
                      <th className={`${colHeadCls} text-right pb-1`}>Конверсия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byAdmin.map((a) => (
                      <tr key={a.adminUsername} className="border-t border-line-soft">
                        <td className={`${cellCls} font-bold text-ink`}>{a.adminUsername}</td>
                        <td className={`${numCls} text-pos`}>{a.booked}</td>
                        <td className={numCls}>{a.declined}</td>
                        <td className={numCls}>{a.notOffered}</td>
                        <td className={numCls}>{pct(a.booked, a.booked + a.declined)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className={subTitleCls}>Причины</div>
              {data.reasons.length === 0 ? (
                <div className={hintCls}>Причин пока нет.</div>
              ) : (
                <div className="flex flex-col gap-1.5" data-table="report-reasons">
                  {data.reasons.map((r) => {
                    const share = reasonTotal(r.outcome)
                    return (
                      <div key={`${r.outcome}|${r.reason}`} className="text-[12.5px] font-semibold text-ink-body">
                        <div className="flex items-baseline justify-between gap-2">
                          <span>
                            <span className={r.outcome === 'declined' ? 'text-neg' : 'text-warn'}>{OUTCOME_LABEL[r.outcome]}</span>
                            <span className="text-ink-disabled"> · </span>
                            <span className="text-ink">{reasonLabel(r.outcome, r.reason)}</span>
                          </span>
                          <span className="whitespace-nowrap">
                            <b className="text-ink">{r.count}</b> <span className="text-ink-muted">{pct(r.count, share)}</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-input overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${r.outcome === 'declined' ? 'bg-neg' : 'bg-warn'}`}
                            style={{ width: share > 0 ? `${(r.count * 100) / share}%` : '0%' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={subTitleCls}>По дням</div>
          <div className="overflow-x-auto mb-5">
            <table className="w-full min-w-[560px]" data-table="report-days">
              <thead>
                <tr>
                  <th className={`${colHeadCls} text-left pb-1`}>День</th>
                  <th className={`${colHeadCls} text-left pb-1`}>По графику</th>
                  <th className={`${colHeadCls} text-right pb-1`}>Были</th>
                  <th className={`${colHeadCls} text-right pb-1`}>Дозапись</th>
                  <th className={`${colHeadCls} text-right pb-1`}>Отказ</th>
                  <th className={`${colHeadCls} text-right pb-1`}>Не предл.</th>
                  <th className={`${colHeadCls} text-right pb-1`}>Не отмечено</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date} className="border-t border-line-soft">
                    <td className={`${cellCls} whitespace-nowrap`}>
                      <span className="text-ink-muted">{DOW_RU_SHORT[dowOfYmd(d.date)]}</span> <b className="text-ink">{fmtCsDate(d.date)}</b>
                    </td>
                    <td className={cellCls}>{d.duty || <span className="text-ink-muted">—</span>}</td>
                    <td className={numCls}>{d.visited}</td>
                    <td className={`${numCls} text-pos`}>{d.booked}</td>
                    <td className={numCls}>{d.declined}</td>
                    <td className={numCls}>{d.notOffered}</td>
                    <td className={numCls}>{d.missing > 0 ? <span className={badgeNegCls}>{d.missing}</span> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className={`${subTitleCls} !mb-0`}>Клиенты</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTERS.map((f) => {
                const n = f === 'all' ? data.rows.length : data.rows.filter((r) => r.outcome === f).length
                return (
                  <button
                    key={f}
                    type="button"
                    className={pillCls(filter === f)}
                    onClick={() => {
                      setFilter(f)
                      setPage(1)
                    }}
                    data-filter={f}
                  >
                    {f === 'all' ? 'Все' : OUTCOME_LABEL[f]} {n}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]" data-table="report-rows">
              <thead>
                <tr>
                  <th className={`${colHeadCls} text-left pb-1`}>Дата</th>
                  <th className={`${colHeadCls} text-left pb-1`}>Клиент</th>
                  <th className={`${colHeadCls} text-left pb-1`}>Визит</th>
                  <th className={`${colHeadCls} text-left pb-1`}>Результат</th>
                  <th className={`${colHeadCls} text-left pb-1`}>Кто</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={`${r.date}|${r.clientDocId}`} className="border-t border-line-soft">
                    <td className={`${cellCls} whitespace-nowrap`}>
                      <b className="text-ink">{fmtCsDate(r.date)}</b> {r.time}
                    </td>
                    <td className={`${cellCls} font-bold text-ink`}>{r.clientName}</td>
                    <td className={cellCls}>
                      {r.services.join(' + ')}
                      {r.employees.length > 0 && <span className="text-ink-muted"> · {r.employees.join(', ')}</span>}
                    </td>
                    <td className={cellCls}>
                      <span className={OUTCOME_CLS[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</span>
                      {r.reason && <span className="text-ink"> {reasonLabel(r.outcome, r.reason)}</span>}
                      {r.comment && <div className="text-ink-muted mt-0.5">«{r.comment}»</div>}
                    </td>
                    <td className={`${cellCls} whitespace-nowrap`}>
                      {r.adminUsername || (r.outcome === 'missing' && r.duty ? <span className="text-ink-muted">смена: {r.duty}</span> : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <div className={`${hintCls} pt-2`}>Таких клиентов нет.</div>}
          <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} unit="клиентов" />
        </>
      )}
    </section>
  )
}
