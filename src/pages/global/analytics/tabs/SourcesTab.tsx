// «Источники броней» (s200): откуда пришли брони, сколько из них — новые клиенты и
// сколько эти новые клиенты принесли за всё время. Нужен, чтобы проверять отчёты
// рекламного агентства по нашим собственным броням, а не по моделям Meta/Google.
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pagination } from '../../../../components/Pagination'
import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  btnNeutralCls,
  cardCls,
  cardTitleCls,
  chipCls,
  colHeadCls,
  headMicroCls,
  hintCls,
  inputCls,
  mutedCls,
  pillCls,
  tileCls,
  tileLabelCls,
  tileSubCls,
  tileValueCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import { addDaysYmd, fmtCsDate, todayYmd } from '../../../../utils/date'
import { kc } from '../../../../utils/money'
import {
  fetchAttributionReport,
  type AttributionBasis,
  type AttributionReport,
  type AttributionRow,
  type AttributionTouch,
} from '../fetch/attribution'

type Preset = 'month' | 'prev' | '30' | 'custom'

const STATUS_LABEL: Record<AttributionRow['status'], string> = {
  active: 'Запланирована',
  checkedOut: 'Состоялась',
  cancelled: 'Отменена',
  noshow: 'Не пришла',
}
const STATUS_CLS: Record<AttributionRow['status'], string> = {
  active: badgeMutedCls,
  checkedOut: badgePosCls,
  cancelled: badgeNegCls,
  noshow: badgeWarnCls,
}

const PAGE_SIZE = 25
const cellCls = 'py-2 pr-3 text-[13px] font-semibold text-ink-body align-top'
const numCls = `${cellCls} text-right whitespace-nowrap w-px`
const thL = `${colHeadCls} text-left pb-1 pr-3`
const thR = `${colHeadCls} text-right pb-1 pr-3 whitespace-nowrap`
const subTitleCls = `${headMicroCls} text-ink-muted mb-2`
const pct = (n: number, of: number): string => (of > 0 ? `${Math.round((n * 100) / of)} %` : '—')

const presetRange = (p: Exclude<Preset, 'custom'>): { from: string; to: string } => {
  const today = todayYmd()
  const monthStart = `${today.slice(0, 8)}01`
  if (p === 'month') return { from: monthStart, to: today }
  if (p === 'prev') {
    const prevEnd = addDaysYmd(monthStart, -1)
    return { from: `${prevEnd.slice(0, 8)}01`, to: prevEnd }
  }
  return { from: addDaysYmd(today, -29), to: today }
}

// Excel в чешской локали ждёт «;» и BOM, иначе кириллица и столбцы разъедутся
const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v)
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const BOM = String.fromCharCode(0xfeff)

function downloadCsv(report: AttributionReport) {
  const head = [
    'Создана', 'Дата визита', 'Время', 'Статус', 'Клиент', 'ID клиента', 'Новый клиент', 'Мастер', 'Цена, Kč',
    'Канал', 'Кампания', 'Первый заход', 'Последний заход', 'Страница входа', 'Кто записал', 'Дозапись', 'ID брони',
  ]
  const lines = report.rows.map((r) =>
    [
      r.created, r.date, r.time || '', STATUS_LABEL[r.status], r.clientName, r.clientId ?? '', r.isNewClient ? 'да' : 'нет',
      r.master, r.price, r.channelLabel, r.campaign, r.firstTouch, r.lastTouch, r.landing,
      r.createdBy || (r.origin === 'site' ? 'сам клиент' : r.origin), r.rebook ? 'да' : '', r.id,
    ].map(csvCell).join(';'),
  )
  const blob = new Blob([BOM + `${[head.join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `zdroje-rezervaci_${report.basis}_${report.from}_${report.to}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SourcesTab() {
  const [preset, setPreset] = useState<Preset>('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [basis, setBasis] = useState<AttributionBasis>('created')
  const [touch, setTouch] = useState<AttributionTouch>('first')
  const [data, setData] = useState<AttributionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState('all')
  const [onlyNew, setOnlyNew] = useState(false)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    if (!range.from || !range.to) return
    setLoading(true)
    setError(null)
    try {
      setData(await fetchAttributionReport({ ...range, basis, touch }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёт')
    } finally {
      setLoading(false)
    }
  }, [range, basis, touch])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [channel, onlyNew, data])

  const rows = useMemo(
    () => (data?.rows || []).filter((r) => (channel === 'all' || r.channel === channel) && (!onlyNew || r.isNewClient)),
    [data, channel, onlyNew],
  )
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const t = data?.totals

  const pickPreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
  }

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              ['month', 'Этот месяц'],
              ['prev', 'Прошлый месяц'],
              ['30', '30 дней'],
              ['custom', 'Свой период'],
            ] as [Preset, string][]
          ).map(([p, label]) => (
            <button key={p} type="button" className={pillCls(preset === p)} onClick={() => pickPreset(p)} data-preset={p}>
              {label}
            </button>
          ))}
          {preset === 'custom' && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                className={`${inputCls} !py-1.5 !text-[13px]`}
                value={range.from}
                max={range.to}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                data-from
              />
              <span className={mutedCls}>—</span>
              <input
                type="date"
                className={`${inputCls} !py-1.5 !text-[13px]`}
                value={range.to}
                min={range.from}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                data-to
              />
            </span>
          )}
        </div>
        <button type="button" className={btnNeutralCls} disabled={!data?.rows.length} onClick={() => data && downloadCsv(data)} data-csv>
          Выгрузить CSV
        </button>
      </div>

      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap mb-3.5">
        <div className="flex items-center gap-1.5">
          <span className={mutedCls}>Период по дате</span>
          <button type="button" className={pillCls(basis === 'created')} onClick={() => setBasis('created')} data-basis="created">
            создания брони
          </button>
          <button type="button" className={pillCls(basis === 'visit')} onClick={() => setBasis('visit')} data-basis="visit">
            визита
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={mutedCls}>Источник по</span>
          <button type="button" className={pillCls(touch === 'first')} onClick={() => setTouch('first')} data-touch="first">
            первому заходу
          </button>
          <button type="button" className={pillCls(touch === 'last')} onClick={() => setTouch('last')} data-touch="last">
            последнему
          </button>
        </div>
      </div>

      {error && <div className={`${hintCls} text-neg mb-3`}>{error}</div>}
      {loading && !data && <div className="text-ink-soft py-8 text-center">Загрузка…</div>}

      {t && data && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3.5">
            <div className={tileCls} data-tile="bookings">
              <div className={tileLabelCls}>Броней</div>
              <div className={tileValueCls}>{t.bookings}</div>
              <div className={tileSubCls}>
                сайт {t.site} · администратор {t.admin}
              </div>
            </div>
            <div className={tileCls} data-tile="new">
              <div className={tileLabelCls}>Новые клиенты</div>
              <div className={tileValueCls}>{t.newClients}</div>
              <div className={tileSubCls}>{pct(t.newClients, t.bookings)} броней</div>
            </div>
            <div className={tileCls} data-tile="revenue">
              <div className={tileLabelCls}>Выручка состоявшихся</div>
              <div className={tileValueCls}>{kc(t.revenue)}</div>
              <div className={tileSubCls}>по ценам броней</div>
            </div>
            <div className={tileCls} data-tile="coverage">
              <div className={tileLabelCls}>Источник записан</div>
              <div className={tileValueCls}>{pct(t.siteWithSource, t.site)}</div>
              <div className={tileSubCls}>
                {t.siteWithSource} из {t.site} броней с сайта
              </div>
            </div>
          </div>

          <section className={`${cardCls} px-5 pt-[18px] pb-4 mb-3.5`}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 className={cardTitleCls}>По каналам</h2>
              <span className={mutedCls}>
                {fmtCsDate(data.from)} – {fmtCsDate(data.to)} · по дате {data.basis === 'created' ? 'создания' : 'визита'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]" data-table="channels">
                <thead>
                  <tr>
                    <th className={thL}>Канал</th>
                    <th className={thR}>Броней</th>
                    <th className={thR}>Новых</th>
                    <th className={thR}>Состоялось</th>
                    <th className={thR}>Отменено</th>
                    <th className={thR}>Не пришла</th>
                    <th className={thR}>Выручка броней</th>
                    <th className={thR} title="Все состоявшиеся визиты новых клиентов этого канала — за всё время, включая повторные записи через администратора">
                      Новые: выручка за всё время
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map((c) => (
                    <tr
                      key={c.key}
                      className={`border-t border-line-soft cursor-pointer hover:bg-surface-hover ${channel === c.key ? 'bg-brand-tint' : ''}`}
                      onClick={() => setChannel(channel === c.key ? 'all' : c.key)}
                      data-channel-row={c.key}
                    >
                      <td className={`${cellCls} font-bold text-ink`}>{c.label}</td>
                      <td className={numCls}>{c.bookings}</td>
                      <td className={`${numCls} text-ink font-extrabold`}>{c.newClients}</td>
                      <td className={numCls}>{c.checkedOut}</td>
                      <td className={numCls}>
                        {c.cancelled} <span className="text-ink-muted">{pct(c.cancelled, c.bookings)}</span>
                      </td>
                      <td className={numCls}>{c.noshow}</td>
                      <td className={numCls}>{kc(c.revenue)}</td>
                      <td className={numCls}>
                        {kc(c.newClientsLifetimeRevenue)}
                        {c.newClientsLifetimeVisits > 0 && <span className="text-ink-muted"> · {c.newClientsLifetimeVisits} виз.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${hintCls} mt-2`}>Нажмите на канал — ниже останутся только его брони.</div>
          </section>

          {data.campaigns.length > 0 && (
            <section className={`${cardCls} px-5 pt-[18px] pb-4 mb-3.5`}>
              <h2 className={`${cardTitleCls} mb-3`}>По кампаниям и сайтам</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]" data-table="campaigns">
                  <thead>
                    <tr>
                      <th className={thL}>Канал</th>
                      <th className={thL}>Кампания / сайт</th>
                      <th className={thR}>Броней</th>
                      <th className={thR}>Новых</th>
                      <th className={thR}>Состоялось</th>
                      <th className={thR}>Отменено</th>
                      <th className={thR}>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={`${c.channel}|${c.campaign}`} className="border-t border-line-soft">
                        <td className={`${cellCls} text-ink-muted`}>{c.channelLabel}</td>
                        <td className={`${cellCls} font-bold text-ink break-all`}>{c.campaign}</td>
                        <td className={numCls}>{c.bookings}</td>
                        <td className={`${numCls} text-ink font-extrabold`}>{c.newClients}</td>
                        <td className={numCls}>{c.checkedOut}</td>
                        <td className={numCls}>{c.cancelled}</td>
                        <td className={numCls}>{kc(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={`${cardCls} px-5 pt-[18px] pb-4 mb-3.5`}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <div className={`${subTitleCls} !mb-0`}>
                Брони{channel !== 'all' && ` · ${data.channels.find((c) => c.key === channel)?.label || ''}`}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {channel !== 'all' && (
                  <button type="button" className={pillCls(false)} onClick={() => setChannel('all')} data-reset-channel>
                    Все каналы
                  </button>
                )}
                <button type="button" className={chipCls(onlyNew)} onClick={() => setOnlyNew((v) => !v)} data-only-new>
                  Только новые клиенты
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]" data-table="rows">
                <thead>
                  <tr>
                    <th className={thL}>Создана</th>
                    <th className={thL}>Визит</th>
                    <th className={thL}>Клиент</th>
                    <th className={thL}>Статус</th>
                    <th className={thL}>Канал</th>
                    <th className={thL}>Заходы (первый → последний)</th>
                    <th className={thR}>Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t border-line-soft">
                      <td className={`${cellCls} whitespace-nowrap`}>{fmtCsDate(r.created.slice(0, 10))} {r.created.slice(11)}</td>
                      <td className={`${cellCls} whitespace-nowrap`}>
                        <b className="text-ink">{fmtCsDate(r.date)}</b> {r.time}
                        {r.master && <div className="text-ink-muted">{r.master}</div>}
                      </td>
                      <td className={cellCls}>
                        <span className="font-bold text-ink">{r.clientName}</span>
                        {r.isNewClient && <span className={`${badgePosCls} ml-1.5`}>новая</span>}
                        {r.rebook && <span className={`${badgeMutedCls} ml-1.5`}>дозапись</span>}
                      </td>
                      <td className={cellCls}>
                        <span className={STATUS_CLS[r.status]}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td className={cellCls}>
                        {r.channelLabel}
                        {r.createdBy && <div className="text-ink-muted">{r.createdBy}</div>}
                        {!r.createdBy && r.campaign && <div className="text-ink-muted break-all">{r.campaign}</div>}
                      </td>
                      <td className={`${cellCls} text-ink-muted break-all`}>
                        {r.hasAttribution ? (
                          <>
                            {r.firstTouch}
                            {r.lastTouch && r.lastTouch !== r.firstTouch && <> → {r.lastTouch}</>}
                            {r.landing && <div>вход: {r.landing}</div>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={numCls}>{kc(r.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <div className={`${hintCls} pt-2`}>Таких броней нет.</div>}
            <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} unit="броней" />
          </section>

          <div className={hintCls}>
            <b>Как считается.</b> Источник брони с сайта записывается с 19.09.2026 — у более ранних броней он «не
            записан». «Первый заход» — самый первый визит на сайт за 90 дней, «последний» — последний заход не
            напрямую (прямой заход платный источник не перетирает). Новый клиент — у человека нет ни одной прошлой
            брони, кроме отменённых, по телефону или e-mail; отменённая бронь новым клиентом не считается. «Выручка
            за всё время» — все состоявшиеся визиты новых клиентов канала, включая повторные записи через
            администратора. Дозапись с thank-you наследует источник исходной брони.
          </div>
        </div>
      )}
    </>
  )
}
