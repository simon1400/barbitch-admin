// Дашборд «Сегодня» (/today, owner + manager), s214 — Фаза B плана «Управляющая».
//
// Одна страница «что требует внимания»: незакрытые визиты, блоки на согласование,
// дозаписи без результата, незакрытые смены, ваучеры, ожидающие переносы корекций
// дни рождения сотрудников, сроки документов сотрудников, личные данные ушедших
// (стирание через 3 года) и кто сегодня работает. Каждая строка — ссылка туда, где это решается.
// Ничего не пишет. Данные — fetch/todayApi.ts (каждый источник отдельно: сбой
// одного не гасит остальные карточки).
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  h1Cls,
  hintCls,
  iconBtnCls,
  kickerCls,
  pageShellCls,
} from '../../ui/kit'
import { DOW_RU_SHORT, dowOfYmd, fmtCsDate, fmtTimePrague, minToHHMM, todayYmd } from '../../utils/date'
import { kc } from '../../utils/money'
import { BirthdaysCardView } from '../../components/BirthdaysCard'
import { CONTRACT_LABEL, DOC_KIND_LABEL } from '../global/team/fetch/staff'
import { RefreshIcon } from '../upsell/components/icons'
import { TodayCard, TodayRow } from './components/TodayCard'
import { loadToday, type TodayData } from './fetch/todayApi'
import { summarizeDay } from './fetch/workingToday'

/** Автообновление, пока вкладка видна. */
const POLL_MS = 120_000

const dm = (ymd: string | null | undefined): string => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '—')
const dayLabel = (ymd: string | null | undefined): string => (ymd ? `${DOW_RU_SHORT[dowOfYmd(ymd)]} ${dm(ymd)}` : '—')
const calLink = (date: string | null | undefined, highlight?: string | null): string =>
  `/calendar?date=${date || ''}${highlight ? `&highlight=${highlight}` : ''}`

const smallCls = 'text-[11.5px] font-semibold text-ink-faint'
const staffLink = (personal: string): string => `/global/team/staff/${encodeURIComponent(personal)}`
/** «просрочен 5 дн.» / «сегодня последний день» / «через 12 дн.» */
const daysLeftText = (n: number): string =>
  n < 0 ? `просрочен ${-n} дн.` : n === 0 ? 'сегодня последний день' : `через ${n} дн.`

export default function TodayPage() {
  const [date, setDate] = useState(todayYmd)
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    // после полуночи дашборд сам переезжает на новый день
    const d = todayYmd()
    setDate(d)
    setLoading(true)
    const res = await loadToday(d)
    if (my !== seq.current) return
    setData(res)
    setUpdatedAt(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  // первая загрузка — «Загрузка…» в карточках; обновление — старые данные остаются на месте
  const first = !data
  const ov = data?.overview
  const overviewErr = ov && !ov.ok ? ov.error : null
  const o = ov?.ok ? ov.data : null

  const visits = o?.unclosedVisits ?? []
  const shifts = o?.openShifts ?? []
  const korekce = o?.korekcePending ?? []
  const paid = o?.vouchers.paidRecent ?? []
  const unpaid = o?.vouchers.unpaid ?? []

  const pb = data?.pendingBlocks
  const blocks = pb?.ok ? pb.data : []
  // серия повторений — один пункт, как в модале «Ke schválení»
  const blockGroups = [...new Map(blocks.map((b) => [b.seriesKey || b.documentId, b])).values()]
  const planReqs = data?.planRequests?.ok ? data.planRequests.data : []
  const blocksCount = new Set(blocks.map((b) => b.seriesKey || b.documentId)).size + planReqs.length

  const up = data?.upsell
  const upsellClients = up?.ok ? up.data : []
  const needResult = upsellClients.filter((c) => c.needsResult)

  const bd = data?.birthdays

  const sr = data?.staff
  const staffDocs = sr?.ok ? sr.data.documents : []
  // договоры (фаза 2 карточки): конец ≤ 30 дней / истёк без нового, испытательный ≤ 14 дней
  const staffContracts = sr?.ok ? (sr.data.contracts ?? []) : []
  const eraseDue = sr?.ok ? sr.data.erase : []
  const noLeftAt = sr?.ok ? sr.data.leftWithoutDate : []

  const dayPart = data?.day
  const working = dayPart?.ok ? summarizeDay(dayPart.data) : null
  const onDuty = data?.roster[date] || null

  return (
    <div className={pageShellCls}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className={kickerCls}>Что требует внимания</div>
          <h1 className={`${h1Cls} !mb-0`}>
            Сегодня · {dayLabel(date)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className={smallCls} data-updated>
              обновлено {fmtTimePrague(new Date(updatedAt).toISOString())}
            </span>
          )}
          <button
            type="button"
            className={iconBtnCls}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Обновить"
            title="Обновить"
          >
            <RefreshIcon className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* 1. Визиты без записи об услуге */}
        <TodayCard
          id="visits"
          title="Незакрытые визиты"
          count={o ? visits.length : null}
          loading={first}
          error={overviewErr}
          okText="Все прошедшие визиты за неделю закрыты"
          link={{ to: '/calendar', label: 'Календарь' }}
        >
          {visits.map((v) => (
            <TodayRow
              key={v.documentId}
              to={calLink(v.date, v.documentId)}
              aside={
                v.reason === 'checked_out_no_record' ? (
                  <span className={`${badgeNegCls} whitespace-nowrap`}>закрыт без записи</span>
                ) : v.arrived ? (
                  <span className={`${badgeWarnCls} whitespace-nowrap`}>не закрыт</span>
                ) : (
                  <span className={`${badgeWarnCls} whitespace-nowrap`}>не отмечен приход</span>
                )
              }
            >
              <b className="text-ink">{v.client || 'Без имени'}</b>
              {v.internal && ' 🤝'}
              {v.korekce && ' 🔁'}
              <div className={smallCls}>
                {v.date !== date ? `${dayLabel(v.date)} · ` : ''}
                {fmtTimePrague(v.startsAt)} · {v.master}
                {v.services.length > 0 && ` · ${v.services.join(', ')}`}
              </div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 2. Блоки на согласование */}
        <TodayCard
          id="blocks"
          title="Блоки ke schválení"
          count={pb?.ok ? blocksCount : null}
          loading={first}
          error={pb && !pb.ok ? pb.error : null}
          okText="Нет блоков, ждущих согласования"
          link={{ to: `/calendar?date=${blockGroups[0]?.date || date}&pending=1`, label: 'Согласовать в календаре' }}
        >
          {blockGroups.slice(0, 8).map((b) => (
            <TodayRow
              key={b.seriesKey || b.documentId}
              aside={<span className={smallCls}>{b.createdByName}</span>}
            >
              <b className="text-ink">{b.employeeName}</b> · {b.title || 'Blok'}
              {b.kind === 'change' ? (
                <span className={`${badgeWarnCls} ml-1.5`}>правка</span>
              ) : (
                b.seriesKey && <span className={`${badgeMutedCls} ml-1.5`}>серия</span>
              )}
              <div className={smallCls}>
                {dayLabel(b.date)}
                {b.startMin != null && b.endMin != null && ` · ${minToHHMM(b.startMin)}–${minToHHMM(b.endMin)}`}
                {b.kind === 'change' &&
                  b.proposedStartMin != null &&
                  b.proposedEndMin != null &&
                  ` → ${minToHHMM(b.proposedStartMin)}–${minToHHMM(b.proposedEndMin)}`}
              </div>
            </TodayRow>
          ))}
          {blockGroups.length > 8 && <div className={hintCls}>…и ещё {blockGroups.length - 8}</div>}
          {planReqs.slice(0, 8).map((r) => (
            <TodayRow key={`plan|${r.personal}|${r.date}`} to={`/schedule?master=${r.personal}&date=${r.date}`} aside={<span className={smallCls}>{r.by}</span>}>
              <b className="text-ink">{r.employeeName}</b> · график: {r.label}
              <span className={`${badgeWarnCls} ml-1.5`}>план</span>
              <div className={smallCls}>{dayLabel(r.date)}</div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 3. Дозаписи без результата */}
        <TodayCard
          id="upsell"
          title="Дозаписи без результата"
          count={up?.ok ? needResult.length : null}
          loading={first}
          error={up && !up.ok ? up.error : null}
          okText={
            upsellClients.length
              ? `У всех пришедших клиентов результат отмечен (клиентов дня: ${upsellClients.length})`
              : 'Сегодня клиентов нет'
          }
          link={{ to: '/upsell', label: 'Дозаписи' }}
        >
          {needResult.map((c) => (
            <TodayRow
              key={c.clientDocId}
              to="/upsell"
              aside={
                <span className={`${c.left ? badgeMutedCls : badgePosCls} whitespace-nowrap`}>
                  {c.left ? 'ушла' : 'в салоне'}
                </span>
              }
            >
              <b className="text-ink">{c.clientName}</b>
              <div className={smallCls}>
                {c.bookings.map((b) => `${b.time} ${b.employeeName}`).join(' · ')}
              </div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 4. Незакрытые смены */}
        <TodayCard
          id="shifts"
          title="Незакрытые смены"
          count={o ? shifts.length : null}
          loading={first}
          error={overviewErr}
          okText="Все смены за две недели закрыты"
          link={{ to: '/global/shift-close', label: 'Uzavření směny' }}
        >
          {shifts.map((s) => (
            <TodayRow key={s.date} to={`/global/shift-close?date=${s.date}`}>
              <b className="text-ink">{dayLabel(s.date)}</b>
              <div className={smallCls}>
                черновики: {s.services > 0 && `услуг ${s.services}`}
                {s.services > 0 && s.hours > 0 && ', '}
                {s.hours > 0 && `часов админа ${s.hours}`}
              </div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 5. Ожидающие переносы корекций */}
        <TodayCard
          id="korekce"
          title="Korekce — перенос доли ждёт"
          count={o ? korekce.length : null}
          loading={first}
          error={overviewErr}
          okText="Нет корекций, ждущих закрытия исходного визита"
        >
          {korekce.map((k) => (
            <TodayRow
              key={k.spDocId}
              to={calLink(k.originalDate, k.originalBookingDocId)}
              aside={<span className={smallCls}>−{kc(k.staffOutKc)}</span>}
            >
              <b className="text-ink">{k.clientName}</b>
              <div className={smallCls}>
                закрыть визит {dayLabel(k.originalDate)} у {k.originalMaster} · korekce {dm(k.korekceDate)} у {k.master}
              </div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 6. Ваучеры */}
        <TodayCard
          id="vouchers"
          title="Ваучеры"
          count={o ? paid.length : null}
          loading={first}
          error={overviewErr}
          okText={
            unpaid.length
              ? `Новых оплат за неделю нет · не оплачено заказов за 30 дней: ${unpaid.length}`
              : 'Новых оплат за неделю нет'
          }
          link={{ to: '/voucher-confirmation', label: 'Potvrzení voucheru' }}
        >
          <div className={smallCls}>Оплачены за 7 дней — проверьте, что potvrzení отправлено:</div>
          {paid.map((v) => (
            <TodayRow key={v.documentId} to="/voucher-confirmation" aside={<b className="text-ink">{kc(v.sum)}</b>}>
              <b className="text-ink">{v.name.trim()}</b>
              {v.for && ` → ${v.for}`}
              <div className={smallCls}>
                № {v.idVoucher} · оплачен {dm(v.datePay)}
              </div>
            </TodayRow>
          ))}
          {unpaid.length > 0 && <div className={hintCls}>Не оплачено заказов за 30 дней: {unpaid.length}</div>}
        </TodayCard>

        {/* 7. Дни рождения сотрудников — ближайшие 30 дней */}
        <BirthdaysCardView
          data={bd?.ok ? bd.data : null}
          loading={first}
          error={bd && !bd.ok ? bd.error : null}
        />

        {/* 8. Сроки документов (s227) и договоров (фаза 2) работающих сотрудников */}
        <TodayCard
          id="staff-docs"
          title="Документы и договоры — сроки"
          count={sr?.ok ? staffDocs.length + staffContracts.length : null}
          loading={first}
          error={sr && !sr.ok ? sr.error : null}
          okText={`Ни у кого из работающих срок документов и договоров не кончается в ближайшие ${sr?.ok ? sr.data.horizonDays : 30} дней`}
          link={{ to: '/global/team/staff', label: 'Сотрудники' }}
        >
          {staffDocs.map((d) => (
            <TodayRow
              key={d.documentId}
              to={staffLink(d.personal)}
              aside={
                <span className={`${d.daysLeft < 0 ? badgeNegCls : badgeWarnCls} whitespace-nowrap`}>
                  {daysLeftText(d.daysLeft)}
                </span>
              }
            >
              <b className="text-ink">{d.name}</b> · {d.title || DOC_KIND_LABEL[d.kind] || d.kind}
              <div className={smallCls}>
                {d.title && d.title.toLowerCase() !== (DOC_KIND_LABEL[d.kind] ?? '').toLowerCase() && `${DOC_KIND_LABEL[d.kind] ?? d.kind} · `}
                действует до {fmtCsDate(d.validUntil)}
              </div>
            </TodayRow>
          ))}
          {staffContracts.map((c) => (
            <TodayRow
              key={`${c.personal}-${c.kind}`}
              to={staffLink(c.personal)}
              aside={
                <span className={`${c.daysLeft < 0 ? badgeNegCls : badgeWarnCls} whitespace-nowrap`}>
                  {daysLeftText(c.daysLeft)}
                </span>
              }
            >
              <b className="text-ink">{c.name}</b> ·{' '}
              {c.kind === 'probation_end' ? `испытательный срок (${CONTRACT_LABEL[c.type] ?? c.type})` : `договор ${CONTRACT_LABEL[c.type] ?? c.type}`}
              <div className={smallCls}>
                {c.kind === 'probation_end'
                  ? `кончается ${fmtCsDate(c.date)}`
                  : c.daysLeft < 0
                    ? `закончился ${fmtCsDate(c.date)} — нового договора нет`
                    : `действует до ${fmtCsDate(c.date)}`}
              </div>
            </TodayRow>
          ))}
        </TodayCard>

        {/* 9. Личные данные ушедших: стирание через 3 года (§8.2) — только когда есть что делать */}
        {eraseDue.length + noLeftAt.length > 0 && (
          <TodayCard
            id="staff-erase"
            title="Личные данные ушедших"
            count={eraseDue.length + noLeftAt.length}
            loading={first}
            link={{ to: '/global/team/staff', label: 'Сотрудники' }}
          >
            {eraseDue.map((r) => (
              <TodayRow
                key={r.personal}
                to={staffLink(r.personal)}
                aside={<span className={`${badgeNegCls} whitespace-nowrap`}>можно стереть</span>}
              >
                <b className="text-ink">{r.name}</b>
                <div className={smallCls}>
                  ушёл(ла) {fmtCsDate(r.leftAt)} · прошло 3 года — сотрите личные данные и сканы в карточке
                </div>
              </TodayRow>
            ))}
            {noLeftAt.map((r) => (
              <TodayRow
                key={r.personal}
                to={staffLink(r.personal)}
                aside={<span className={`${badgeMutedCls} whitespace-nowrap`}>нет даты ухода</span>}
              >
                <b className="text-ink">{r.name}</b>
                <div className={smallCls}>укажите дату ухода — иначе срок стирания не посчитается</div>
              </TodayRow>
            ))}
          </TodayCard>
        )}
      </div>

      {/* 8. Кто сегодня работает — во всю ширину */}
      <div className="mt-3.5">
        <TodayCard
          id="working"
          title="Кто сегодня работает"
          count={null}
          loading={first}
          error={dayPart && !dayPart.ok ? dayPart.error : null}
          link={{ to: '/calendar', label: 'Календарь' }}
        >
          <div className="flex items-center gap-4 flex-wrap text-[13px] font-semibold text-ink-body">
            <span data-on-duty={onDuty || ''}>
              Администратор: <b className="text-ink">{onDuty || 'в графике не указан'}</b>
            </span>
            {working && (
              <span data-salon-load={working.loadPct ?? ''}>
                Загрузка салона: <b className="text-ink">{working.loadPct == null ? '—' : `${working.loadPct} %`}</b>
              </span>
            )}
          </div>
          {working?.masters
            .slice()
            .sort((a, b) => Number(a.off) - Number(b.off) || (a.firstMin ?? 1e9) - (b.firstMin ?? 1e9))
            .map((m) => (
              <TodayRow
                key={m.id}
                aside={
                  m.off ? (
                    <span className={`${badgeMutedCls} whitespace-nowrap`}>не работает</span>
                  ) : (
                    <span className="text-[13px] font-extrabold text-ink">
                      {m.loadPct == null ? '—' : `${m.loadPct} %`}
                    </span>
                  )
                }
              >
                <span data-master={m.name} data-load={m.loadPct ?? ''} data-off={m.off ? '1' : undefined}>
                  <b className="text-ink">{m.name}</b>
                  {!m.off && (
                    <span className={`${smallCls} ml-2`}>
                      визитов {m.visits}
                      {m.internal > 0 && ` + интерных ${m.internal}`}
                      {m.firstMin != null && m.lastMin != null && ` · ${minToHHMM(m.firstMin)}–${minToHHMM(m.lastMin)}`}
                    </span>
                  )}
                </span>
                {!m.off && (
                  <div className="h-1.5 mt-1 rounded-full bg-line-soft overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, m.loadPct ?? 0)}%` }} />
                  </div>
                )}
              </TodayRow>
            ))}
        </TodayCard>
      </div>
    </div>
  )
}
