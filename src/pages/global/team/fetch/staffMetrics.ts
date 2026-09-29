// Личная сводка «Показатели» в карточке сотрудника (s227, §7.9 плана карточки).
//
// 🟥 Новых расчётов денег здесь нет — только срез по одному человеку из того, что уже
// считают другие экраны:
//   • месяц — `getGlobalMonthData` (тот же кэш и та же формула, что «Зарплаты»),
//     загрузка мастера — `getMasterLoad` («Загрузка»), дозаписи администратора —
//     отчёт «Контроль предложений» (`fetchUpsellReport`);
//   • помесячно за год и возвращаемость — общая история броней аналитики
//     (`getEventsHistory`, `getRetention`): визиты и сумма по цене броней, не деньги кассы.
// Грузится только при раскрытии секции: месячные данные тяжёлые.
import { ym } from '../../../../utils/date'
import { getGlobalMonthData, type GlobalMonthData } from '../../../dashboard/fetch/monthDataCache'
import { fetchUpsellReport } from '../../../upsell/fetch/upsellApi'
import { getEventsHistory, isAttended, type HistEvent } from '../../analytics/fetch/eventsHistory'
import { getRetention, type RetentionRow } from '../../analytics/fetch/retention'
import { getMasterLoad, type MasterLoadRow } from './masterLoad'
import type { StaffCard } from './staff'

type Settled<T> = { ok: true; data: T } | { ok: false; error: string }

const settle = <T>(r: PromiseSettledResult<T>): Settled<T> =>
  r.status === 'fulfilled'
    ? { ok: true, data: r.value }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }

const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** 'YYYY-MM' + n месяцев. */
const addMonthsYm = (m: string, n: number): string => {
  const [y, mo] = m.split('-').map(Number)
  return ym(new Date(y, mo - 1 + n, 1))
}

/** Строки человека в месячных данных зарплат — по имени, как их собирает «Зарплаты». */
export const pickMonthRows = (data: GlobalMonthData, name: string) => {
  const key = lower(name)
  const by = <T extends { name: string }>(rows: T[]) => rows.find((r) => lower(r.name) === key) ?? null
  return {
    work: by(data.works),
    admin: by(data.admins),
    combined: by(data.combined),
    manager: by(data.managers),
  }
}
export type MonthRows = ReturnType<typeof pickMonthRows>

export interface MonthMetrics {
  rows: Settled<MonthRows>
  load: Settled<MasterLoadRow | null> | null
  upsell: Settled<{ booked: number; declined: number; notOffered: number } | null> | null
}

/** month — 0-based (как «Зарплаты»). */
export const loadMonthMetrics = async (card: StaffCard, month: number, year: number): Promise<MonthMetrics> => {
  const master = card.position === 'master'
  const key = card.booking.noonaEmployeeId
  const login = card.account?.username || card.name
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`
  const [rows, load, upsell] = await Promise.allSettled([
    getGlobalMonthData(month, year).then((r) => pickMonthRows(r.data, card.name)),
    master && key ? getMasterLoad(month, year).then((r) => r.rows.find((x) => x.employeeId === key) ?? null) : null,
    master
      ? null
      : fetchUpsellReport(ym).then((r) => r.byAdmin.find((a) => lower(a.adminUsername) === lower(login)) ?? null),
  ])
  return {
    rows: settle(rows),
    load: master && key ? settle(load as PromiseSettledResult<MasterLoadRow | null>) : null,
    upsell: master ? null : settle(upsell as PromiseSettledResult<{ booked: number; declined: number; notOffered: number } | null>),
  }
}

export interface MonthHistoryRow {
  month: string // 'YYYY-MM'
  visits: number
  /** сумма по цене броней состоявшихся визитов */
  revenue: number
  avgCheck: number | null
  /** отменённые клиентом/салоном и неявки */
  lost: number
}

/**
 * Помесячно за `months` месяцев, заканчивая месяцем `today` (включительно): состоявшиеся
 * визиты мастера и сумма по их броням. Будущие брони текущего месяца не считаются.
 */
export const monthlyFromHistory = (events: HistEvent[], employeeKey: string, today: string, months = 12): MonthHistoryRow[] => {
  const last = today.slice(0, 7)
  const first = addMonthsYm(last, -(months - 1))
  const acc = new Map<string, MonthHistoryRow>()
  for (let i = 0; i < months; i++) {
    const m = addMonthsYm(first, i)
    acc.set(m, { month: m, visits: 0, revenue: 0, avgCheck: null, lost: 0 })
  }
  for (const e of events) {
    if (e.employee !== employeeKey || !e.date || e.date > today) continue
    const row = acc.get(e.date.slice(0, 7))
    if (!row) continue
    if (isAttended(e)) {
      row.visits += 1
      row.revenue += Number(e.price) || 0
    } else if (e.status === 'cancelled' || e.status === 'noshow') row.lost += 1
  }
  const out = [...acc.values()]
  for (const r of out) r.avgCheck = r.visits ? Math.round(r.revenue / r.visits) : null
  return out.reverse() // свежие сверху
}

export interface HistoryMetrics {
  months: Settled<MonthHistoryRow[]>
  retention: Settled<RetentionRow | null>
}

export const loadHistoryMetrics = async (employeeKey: string, today: string): Promise<HistoryMetrics> => {
  const [months, retention] = await Promise.allSettled([
    getEventsHistory().then((ev) => monthlyFromHistory(ev, employeeKey, today)),
    getRetention().then((r) => r.rows.find((x) => x.employeeId === employeeKey) ?? null),
  ])
  return { months: settle(months), retention: settle(retention) }
}
