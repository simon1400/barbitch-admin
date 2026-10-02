// «Výkaz práce» (s239): ежедневный отчёт управляющей владельцу.
//
// 🟥 Данные — ТОЛЬКО ручки движка `/engine/admin/work-reports…`: у коллекции нет REST.
// Свой отчёт (`/mine`) — сервер сам находит карточку сессии, id в запросе нет.
// Все отчёты, «přečteno», оценка и «Сегодня» — только владелец (`requireOwner`).
// Категории, причины volno, окно дозаполнения и пороги приходят с сервера —
// список правится в одном месте (services/work-reports.ts).
import { makeApiFetch } from '../../../lib/apiFetch'

export interface ReportItem {
  category: string
  text: string
}

export type ReportStatus = 'submitted' | 'day_off'
/** вовремя — до 10:00 следующего дня, позже — поздно (сервер, ON_TIME_UNTIL_MIN) */
export type Lateness = 'on_time' | 'late'

export interface ReportContent {
  status: ReportStatus
  dayOffReason: string | null
  hours: number | null
  items: ReportItem[]
  done: string
  carried: string
  needsOwner: string
  planTomorrow: string
}

export interface ReportComment {
  at: string
  authorName: string
  role: string
  text: string
}

export interface WorkReport extends ReportContent {
  documentId: string
  date: string
  submittedAt: string | null
  late: Lateness | null
  editedAt: string | null
  /** исправлен после прочтения владельцем (снимается следующим прочтением) */
  editedAfterReview: boolean
  history: { at: string; snapshot: ReportContent }[]
  reviewedAt: string | null
  reviewedBy: string | null
  rating: number | null
  comments: ReportComment[]
  createdAt: string | null
  updatedAt: string | null
}

export type DayState =
  | 'on_time'
  | 'late'
  | 'day_off'
  | 'time_off'
  | 'weekend'
  | 'open'
  | 'missing'
  | 'future'
  | 'before'

export interface ReportDay {
  date: string
  state: DayState
  expected: boolean
  reportId: string | null
}

export interface ReportSummary {
  expected: number
  submitted: number
  onTime: number
  late: number
  missing: number
  dayOff: number
  timeOff: number
  hours: number
  avgRating: number | null
  unread: number
}

export interface Labeled {
  key: string
  label: string
}

export interface ReportsMeta {
  today: string
  since: string
  backfillDays: number
  /** раньше этого дня — не заполнить и не исправить */
  earliest: string
  hours: { min: number; max: number; step: number }
  categories: Labeled[]
  dayOffReasons: Labeled[]
}

export interface ReportsMonth extends ReportsMeta {
  month: string
  days: ReportDay[]
  /** отчёты месяца и BACKFILL_DAYS до него (вчерашний план на 1-е число) */
  reports: WorkReport[]
  summary: ReportSummary
  timeOffs: { type: string; startDate: string; endDate: string }[]
}

export interface MyReports extends ReportsMonth {
  name: string
}

export interface ReportsList extends ReportsMonth {
  people: { documentId: string; name: string; isActive: boolean }[]
  personal: string | null
}

export interface ReportsAttention {
  today: string
  from: string
  unread: {
    documentId: string
    personal: string
    name: string
    date: string
    hours: number | null
    items: number
    late: Lateness | null
    editedAfterReview: boolean
  }[]
  missing: { personal: string; name: string; date: string }[]
  questions: { documentId: string; personal: string; name: string; date: string; text: string }[]
  todayState: { personal: string; name: string; state: DayState }[]
}

/** Тело сохранения: отчёт или «nepracovní den». */
export type ReportInput =
  | {
      status: 'submitted'
      hours: string | number
      items: ReportItem[]
      done: string
      carried: string
      needsOwner: string
      planTomorrow: string
    }
  | { status: 'day_off'; dayOffReason: string }

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Relace vypršela — přihlaste se znovu.',
  owner_only: 'Výkazy čte jen majitel.',
  report_changed: 'Výkaz se mezitím změnil — načetla jsem ho znovu, zkuste to prosím ještě jednou.',
  // ostatní kódy — text ze serveru (česky)
}

const reportsFetch = makeApiFetch('/api/engine/admin/work-reports', CODE_MESSAGES, (s) => `Chyba ${s}`)

export const fetchMyReports = (month: string) =>
  reportsFetch<MyReports>('GET', `/mine?month=${encodeURIComponent(month)}`)

export const saveMyReport = (date: string, body: ReportInput) =>
  reportsFetch<MyReports & { saved: WorkReport }>('PUT', `/mine/${encodeURIComponent(date)}`, body)

export const commentMyReport = (date: string, text: string) =>
  reportsFetch<{ saved: WorkReport }>('POST', `/mine/${encodeURIComponent(date)}/comments`, { text })

export const fetchReportsList = (month: string, personal?: string | null) =>
  reportsFetch<ReportsList>(
    'GET',
    `?month=${encodeURIComponent(month)}${personal ? `&personal=${encodeURIComponent(personal)}` : ''}`,
  )

export const reviewReport = (id: string, body: { seen?: true; rating?: number | null; comment?: string }) =>
  reportsFetch<{ saved: WorkReport }>('POST', `/${encodeURIComponent(id)}/review`, body)

export const fetchReportsAttention = () => reportsFetch<ReportsAttention>('GET', '/attention')

// ── подписи (чешский интерфейс, решение владельца §8.10) ──────────────────────

export const LATE_LABEL: Record<Lateness, string> = {
  on_time: 'včas',
  late: 'pozdě',
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  on_time: 'odevzdáno včas',
  late: 'odevzdáno pozdě',
  day_off: 'nepracovní den',
  time_off: 'dovolená / nemoc',
  weekend: 'víkend',
  open: 'ještě lze včas (do 10:00 dalšího dne)',
  missing: 'chybí výkaz',
  future: '',
  before: '',
}

/** «7,5 h». */
export const fmtHours = (h: number | null | undefined): string =>
  h == null ? '—' : `${String(h).replace('.', ',')} h`

export const labelOf = (list: Labeled[], key: string | null | undefined): string =>
  list.find((x) => x.key === key)?.label ?? key ?? '—'

/** YYYY-MM соседнего месяца. */
export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MONTHS_CS = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
]

/** «říjen 2026». */
export const monthLabelCs = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS_CS[m - 1] ?? month} ${y}`
}

/** Последний (до `date`) отчёт с «Plán na zítra» — подставить в «Na čem jsem pracovala». */
export const planBefore = (reports: WorkReport[], date: string): WorkReport | null => {
  let best: WorkReport | null = null
  for (const r of reports) {
    if (r.date < date && r.status === 'submitted' && r.planTomorrow.trim() && (!best || r.date > best.date)) best = r
  }
  return best
}
