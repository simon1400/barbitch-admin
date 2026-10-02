// Дашборд «Сегодня» (/today, owner + manager), s214 — Фаза B плана «Управляющая».
//
// Собирает «что требует внимания» из ДЕСЯТИ источников. Каждый грузится сам по
// себе (allSettled): сбой одного — ошибка на своей карточке, остальные видны.
//   • GET /engine/admin/today — незакрытые визиты, незакрытые смены, ожидающие
//     переносы корекций, ваучеры (новая ручка: админка сама это не соберёт);
//   • блоки «Ke schválení», дозаписи дня, день календаря и график дежурных —
//     те же функции, что у календаря и «Дозаписей», своей копии запросов нет;
//   • дни рождения сотрудников на 30 дней вперёд (s221) — lib/birthdays;
//   • сроки документов сотрудников и стирание личных данных через 3 года (s227) —
//     ручка карточки сотрудника `/engine/admin/staff-reminders`;
//   • затраты (s237): запросы управляющей ждут одобрения (только владельцу) и
//     постоянные расходы месяца, которые ещё не внесены — `/engine/admin/costs/attention`;
//   • «Výkaz práce» (s239, только владельцу): непрочитанные отчёты управляющей, дни без
//     отчёта, «нужно решение владельца» — `/engine/admin/work-reports/attention`.
//     Управляющей ручка не нужна (401) — для неё источник не запрашивается вовсе.
import { makeApiFetch } from '../../../lib/apiFetch'
import { fetchPendingBlocks, type PendingBlock } from '../../calendar/fetch/engineApi'
import type { PlanRequest } from '../../schedule/fetch/schedule'
import {
  fetchAdminRoster,
  fetchCalendarDay,
  type AdminRoster,
  type CalendarDay,
} from '../../calendar/fetch/calendarDay'
import { fetchUpsellDay, type UpsellClient } from '../../upsell/fetch/upsellApi'
import { fetchBirthdays, type Birthdays } from '../../../lib/birthdays'
import { mondayOfYmd } from '../../../utils/date'
import { fetchStaffReminders, type StaffReminders } from '../../global/team/fetch/staff'
import { fetchCostsAttention, type CostsAttention } from '../../global/fetch/expenses'
import { fetchReportsAttention, type ReportsAttention } from '../../vykaz/fetch/workReports'
import { getSessionRole } from '../../../services/auth'

export interface UnclosedVisit {
  documentId: string
  date: string
  startsAt: string | null
  status: string
  /** not_closed — время вышло, визит не закрыт; checked_out_no_record — закрыт мимо формы */
  reason: 'not_closed' | 'checked_out_no_record'
  arrived: boolean
  internal: boolean
  korekce: boolean
  client: string
  master: string
  services: string[]
}

export interface OpenShift {
  date: string
  services: number
  hours: number
}

export interface KorekcePending {
  spDocId: string
  clientName: string
  korekceDate: string | null
  korekceBookingDocId: string | null
  master: string
  originalDate: string | null
  originalBookingDocId: string | null
  originalMaster: string
  staffInKc: number
  staffOutKc: number
}

export interface TodayVoucher {
  documentId: string
  idVoucher: string
  name: string
  for: string
  sum: number
  dateOrder: string | null
  datePay: string | null
}

export interface TodayOverview {
  date: string
  now: string
  unclosedVisits: UnclosedVisit[]
  openShifts: OpenShift[]
  korekcePending: KorekcePending[]
  vouchers: { paidRecent: TodayVoucher[]; unpaid: TodayVoucher[] }
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Дашборд доступен только руководству салона.',
  unauthorized: 'Сессия истекла — войдите снова.',
}

const todayFetch = makeApiFetch('/api', CODE_MESSAGES, (status) => `Ошибка ${status}`)

export const fetchTodayOverview = (date: string) =>
  todayFetch<TodayOverview>('GET', `/engine/admin/today?date=${encodeURIComponent(date)}`)

/** Результат одного источника: данные или текст ошибки для его карточки. */
export type Part<T> = { ok: true; data: T } | { ok: false; error: string }

export interface TodayData {
  overview: Part<TodayOverview>
  pendingBlocks: Part<PendingBlock[]>
  /** предложения изменений планового графика (s218) — тот же ответ, что у блоков */
  planRequests: Part<PlanRequest[]>
  upsell: Part<UpsellClient[]>
  day: Part<CalendarDay>
  /** дни рождения сотрудников в ближайшие 30 дней (s221) */
  birthdays: Part<Birthdays>
  /** сроки документов и стирание личных данных (s227) */
  staff: Part<StaffReminders>
  /** затраты: запросы на одобрение и не внесённые постоянные (s237) */
  costs: Part<CostsAttention>
  /** отчёты управляющей (s239) — null, если сессия не владельца */
  reports: Part<ReportsAttention | null>
  roster: AdminRoster
}

const part = <T,>(r: PromiseSettledResult<T>): Part<T> =>
  r.status === 'fulfilled'
    ? { ok: true, data: r.value }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }

export async function loadToday(date: string): Promise<TodayData> {
  const pendingRes = fetchPendingBlocks()
  const isOwner = getSessionRole() === 'owner'
  const [overview, pending, plan, upsell, day, roster, birthdays, staff, costs, reports] = await Promise.allSettled([
    fetchTodayOverview(date),
    pendingRes.then((r) => r.items || []),
    pendingRes.then((r) => r.planRequests || []),
    // клиенты дня: и те, кто в салоне/придёт, и уже ушедшие (им тоже нужен результат)
    fetchUpsellDay(date).then((d) => [...(d.clients || []), ...(d.leftClients || [])]),
    fetchCalendarDay(date),
    fetchAdminRoster(mondayOfYmd(date)),
    fetchBirthdays(),
    fetchStaffReminders(),
    fetchCostsAttention(),
    isOwner ? fetchReportsAttention() : Promise.resolve(null),
  ])
  return {
    overview: part(overview),
    pendingBlocks: part(pending),
    planRequests: part(plan),
    upsell: part(upsell),
    day: part(day),
    birthdays: part(birthdays),
    staff: part(staff),
    costs: part(costs),
    reports: part(reports),
    // график — вспомогательная инфа, fetchAdminRoster сам глотает ошибки
    roster: roster.status === 'fulfilled' ? roster.value : {},
  }
}
