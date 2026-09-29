import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMonthYear } from '../../../../../hooks/useMonthYear'
import {
  btnNeutralCls,
  colHeadCls,
  hintCls,
  mutedCls,
  tileCls,
  tileLabelCls,
  tileSubCls,
  tileValueCls,
} from '../../../../../ui/kit'
import { monthLabelRu, todayDate, todayYmd } from '../../../../../utils/date'
import { dec, kc } from '../../../../../utils/money'
import { Select } from '../../../../dashboard/components/Select'
import type { StaffCard } from '../../fetch/staff'
import {
  loadHistoryMetrics,
  loadMonthMetrics,
  type HistoryMetrics,
  type MonthMetrics,
} from '../../fetch/staffMetrics'
import { SectionCard } from './ui'

const linkCls = 'font-semibold text-brand-dark underline'

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className={tileCls}>
      <div className={tileLabelCls}>{label}</div>
      <div className={tileValueCls}>{value}</div>
      {sub != null && <div className={tileSubCls}>{sub}</div>}
    </div>
  )
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v} %`)

// «Показатели» (s227): срез по человеку из «Зарплат», «Загрузки», «Дозаписей» и аналитики.
// Новых расчётов нет; грузится только по кнопке — месячные данные тяжёлые.
export function StaffMetricsSection({ card }: { card: StaffCard }) {
  const [open, setOpen] = useState(false)
  return (
    <SectionCard
      title="Показатели"
      testId="staff-metrics"
      action={
        !open && (
          <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => setOpen(true)}>
            Показать
          </button>
        )
      }
    >
      {open ? (
        <MetricsBody card={card} />
      ) : (
        <div className={hintCls}>
          Зарплата и загрузка за месяц, визиты по месяцам за год, возвращаемость клиентов — из тех же данных, что «Зарплаты»,
          «Загрузка» и «Аналитика».
        </div>
      )}
    </SectionCard>
  )
}

function MetricsBody({ card }: { card: StaffCard }) {
  const { month, setMonth, year, setYear } = useMonthYear()
  const [monthData, setMonthData] = useState<MonthMetrics | null>(null)
  const [history, setHistory] = useState<HistoryMetrics | null>(null)
  const seq = useRef(0)
  const master = card.position === 'master'
  const key = card.booking.noonaEmployeeId

  useEffect(() => {
    const my = ++seq.current
    setMonthData(null)
    void loadMonthMetrics(card, month, year).then((r) => {
      if (my === seq.current) setMonthData(r)
    })
    // карточку перечитывают после каждой правки — месяц перегружаем только по имени/должности
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.documentId, card.name, card.position, month, year])

  useEffect(() => {
    if (!master || !key) return
    let alive = true
    void loadHistoryMetrics(key, todayYmd()).then((r) => {
      if (alive) setHistory(r)
    })
    return () => {
      alive = false
    }
  }, [master, key])

  const now = todayDate()
  const current = now.getFullYear() === year && now.getMonth() === month

  return (
    <div data-testid="staff-metrics-body">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        {!monthData && <span className={mutedCls}>Загрузка…</span>}
      </div>
      {monthData && <MonthBlock data={monthData} current={current} />}
      <div className="mt-2 flex gap-x-4 gap-y-1 flex-wrap text-[13px]">
        <Link to="/global/team/salaries" className={linkCls}>
          Зарплаты
        </Link>
        {master && (
          <Link to="/global/team/load" className={linkCls}>
            Загрузка
          </Link>
        )}
        {!master && (
          <Link to="/upsell" className={linkCls}>
            Дозаписи
          </Link>
        )}
      </div>

      {master && !key && <div className={`mt-4 ${hintCls}`}>У мастера нет колонки календаря — истории визитов нет.</div>}
      {master && key && <HistoryBlock data={history} />}
    </div>
  )
}

function MonthBlock({ data, current }: { data: MonthMetrics; current: boolean }) {
  const rows = data.rows
  const tiles: ReactNode[] = []
  const noRow = rows.ok && !rows.data.work && !rows.data.admin && !rows.data.combined && !rows.data.manager
  if (rows.ok) {
    const { work, admin, combined, manager } = rows.data
    if (combined) {
      tiles.push(
        <Tile key="c-clients" label="Клиентов" value={combined.countClient} />,
        <Tile key="c-sum" label="Доля мастера" value={kc(combined.sum)} sub={combined.sumTip ? `+ чаевые ${kc(combined.sumTip)}` : undefined} />,
        <Tile key="c-hours" label="Часов админом" value={dec(combined.hours)} sub={`за часы ${kc(combined.adminEarnings)}`} />,
      )
    } else if (manager) {
      tiles.push(<Tile key="m-fixed" label="Оклад" value={kc(manager.fixed)} sub={manager.fixedMissing ? 'оклад не задан' : undefined} />)
      if (manager.countClient) tiles.push(<Tile key="m-sum" label="Доля мастера" value={kc(manager.sum)} sub={`клиентов ${manager.countClient}`} />)
    } else {
      if (work) {
        tiles.push(
          <Tile key="w-clients" label="Клиентов" value={work.countClient} />,
          <Tile key="w-sum" label="Доля мастера" value={kc(work.sum)} sub={work.sumTip ? `+ чаевые ${kc(work.sumTip)}` : undefined} />,
        )
      }
      if (admin) tiles.push(<Tile key="a-hours" label="Часов" value={dec(admin.sum)} sub={`за часы ${kc(admin.earned)}`} />)
    }
  }
  if (data.load?.ok && data.load.data) {
    const l = data.load.data
    tiles.push(
      <Tile
        key="load"
        label="Загрузка"
        value={pct(current ? l.pastPct : l.pct)}
        sub={`${current ? 'по прошедшим дням · ' : ''}рабочих дней ${l.workingDays}`}
      />,
    )
  }
  if (data.upsell?.ok) {
    const u = data.upsell.data
    tiles.push(
      <Tile
        key="upsell"
        label="Дозаписи"
        value={u ? u.booked : 0}
        sub={u ? `отказ ${u.declined} · не предлагали ${u.notOffered}` : 'отметок нет'}
      />,
    )
  }

  const errors = [
    !rows.ok && `зарплаты: ${rows.error}`,
    data.load && !data.load.ok && `загрузка: ${data.load.error}`,
    data.upsell && !data.upsell.ok && `дозаписи: ${data.upsell.error}`,
  ].filter(Boolean)

  return (
    <>
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="staff-metrics-month">
          {tiles}
        </div>
      )}
      {noRow && <div className={`${tiles.length ? 'mt-2 ' : ''}${hintCls}`}>За этот месяц в зарплатах строки нет.</div>}
      {errors.length > 0 && (
        <div className="mt-2 text-[12.5px] font-semibold text-neg" role="alert">
          Не удалось загрузить — {errors.join('; ')}
        </div>
      )}
    </>
  )
}

function HistoryBlock({ data }: { data: HistoryMetrics | null }) {
  if (!data) return <div className={`mt-4 ${mutedCls}`}>История визитов: загрузка…</div>
  const r = data.retention
  return (
    <div className="mt-5" data-testid="staff-metrics-history">
      <div className="text-[13px] font-extrabold text-ink mb-2">Визиты по месяцам (по ценам броней)</div>
      {data.months.ok ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                <th className={`${colHeadCls} text-left py-1.5 pr-3`}>Месяц</th>
                <th className={`${colHeadCls} text-right py-1.5 px-2`}>Визитов</th>
                <th className={`${colHeadCls} text-right py-1.5 px-2`}>Сумма броней</th>
                <th className={`${colHeadCls} text-right py-1.5 px-2`}>Средний чек</th>
                <th className={`${colHeadCls} text-right py-1.5 pl-2`}>Отмены и неявки</th>
              </tr>
            </thead>
            <tbody>
              {data.months.data.map((m) => (
                <tr key={m.month} className="border-t border-line-soft font-semibold text-ink-body">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{monthLabelRu(m.month)}</td>
                  <td className="py-1.5 px-2 text-right">{m.visits || '—'}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{m.visits ? kc(m.revenue) : '—'}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{m.avgCheck == null ? '—' : kc(m.avgCheck)}</td>
                  <td className="py-1.5 pl-2 text-right">{m.lost || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[12.5px] font-semibold text-neg">Не удалось загрузить историю: {data.months.error}</div>
      )}

      <div className="text-[13px] font-extrabold text-ink mt-5 mb-2">Возвращаемость новых клиентов</div>
      {!r.ok ? (
        <div className="text-[12.5px] font-semibold text-neg">Не удалось загрузить: {r.error}</div>
      ) : !r.data ? (
        <div className={hintCls}>Новых клиентов с первым визитом у этого мастера нет.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Tile label="Вернулись за 30 дн." value={pct(r.data.r30.pct)} sub={`из ${r.data.r30.eligible}`} />
            <Tile label="за 60 дн." value={pct(r.data.r60.pct)} sub={`из ${r.data.r60.eligible}`} />
            <Tile label="за 90 дн." value={pct(r.data.r90.pct)} sub={`из ${r.data.r90.eligible}`} />
            <Tile label="к тому же мастеру, 90 дн." value={pct(r.data.same90.pct)} sub={`из ${r.data.same90.eligible}`} />
          </div>
          <div className={`mt-2 ${hintCls}`}>Клиент считается новым у мастера своего первого визита в салон; «вернулся» — любой следующий визит.</div>
        </>
      )}
    </div>
  )
}
