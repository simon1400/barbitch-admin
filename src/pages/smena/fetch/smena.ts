// «Směna» (s263, Фаза 1 плана ADMIN_SHIFT_NEXT_SESSION_PROMPT.md): касса и рабочие часы
// администраторов из админки вместо панели Strapi.
//
// 🟥 Пишется ТОЛЬКО ручками движка `/engine/admin/smena/…`: прямой REST `cashs`/`work-times`
// роли administrator закрыт (middleware, s263). Проверку кассы (остаток = прошлый остаток + Σ
// строк), окно дат, часы из начала/конца и HTML комментария делает сервер (services/smena.ts) —
// здесь только подсказки на лету. Ожидаемый остаток НЕ подставляется в поле «Spočítáno»:
// это пересчёт кассы руками, а не формула (§3.4 плана).
// s265 «Předání směny» (Фаза 2, §0в): одной кнопкой — сообщение коллеге, задачи ей и передача своих
// незавершённых (`PUT …/:date/handover`); у получательницы «Vzkaz z minulé směny» с «Přečteno».
// s266 (Фаза 3): «Kontrola směny» (`GET …/:date/check` — тот же расчёт, что виджет панели Strapi),
// руководство правит любой прошедший день и часы любой администраторки (`personal`), сводка для
// «Сегодня» (`GET …/attention`), текст и вложения задач в «Úkoly splněné dnes».
import { ApiError, makeApiFetch } from '../../../lib/apiFetch'

export interface FlowLine {
  sum: number
  comment: string
}

export interface CashDay {
  documentId: string
  /** опубликована закрытием смены — только чтение */
  closed: boolean
  balance: number
  flow: FlowLine[]
  comment: string
  income: number
  outflow: number
  /** кто завёл запись (карточка) */
  byName: string
  /** кто сохранил последним (логин из журнала) */
  lastSavedBy: string
  updatedAt: string | null
}

export interface WorkTimeDay {
  documentId: string
  closed: boolean
  startTime: string
  endTime: string
  hours: number
  comment: string
  name: string
  personal: string | null
  updatedAt: string | null
}

export interface TaskDoneFile {
  documentId: string
  fileName: string
  mime: string | null
  size: number
  createdAt: string | null
}

export interface TaskDone {
  documentId: string
  title: string
  doneAt: string
  by: string
  status: string
  /** s266: её записи этого дня с текстом (hotovo / průběh / komentář) */
  notes?: { kind: 'done' | 'progress' | 'comment'; at: string; text: string }[]
  /** s266: вложения задачи — только в сводке руководству */
  files?: TaskDoneFile[]
}

export interface HandoverTaskRef {
  documentId: string
  /** `new` — поставлена этим действием, `handover` — передана */
  kind: 'new' | 'handover'
  title: string
  status: string | null
}

export interface Handover {
  documentId: string
  date: string | null
  fromName: string
  fromPersonal: string | null
  toName: string
  toPersonal: string | null
  text: string
  tasks: HandoverTaskRef[]
  readAt: string | null
  readBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SmenaDay {
  date: string
  today: string
  /** день в окне записи (сегодня и `backfillDays` назад) */
  editable: boolean
  editableFrom: string
  backfillDays: number
  role: 'owner' | 'manager' | 'administrator'
  me: { documentId: string; name: string } | null
  canWriteHours: boolean
  /** s266: руководство пишет и правит часы любой администраторки (у старого сервера поля нет) */
  canEditTeamHours?: boolean
  cash: CashDay | null
  cashDuplicate: boolean
  prevBalance: number
  prevDate: string | null
  /** есть касса позже по дате — суммы этого дня менять нельзя */
  laterCashExists: boolean
  workTime: WorkTimeDay | null
  /** часы коллег — только руководству */
  others: WorkTimeDay[]
  tasksDone: TaskDone[]
  check: { cashMissing: boolean; workTimeMissing: boolean | null; visitsOpen: number | null }
  slots: string[]
  discrepancyLabel: string
  /** s265: мне — непрочитанные и прочитанные сегодня (у старого сервера полей нет) */
  handoverIn?: Handover[]
  /** s265: мои сообщения за этот день */
  handoverOut?: Handover[]
  /** s265: кому можно передать (работающие администраторки без меня) */
  colleagues?: { documentId: string; name: string }[]
  /** s265: кто следующий по графику — только подсказка (имена в графике — свободный текст) */
  nextDuty?: { date: string; name: string } | null
}

export interface SmenaSummaryPerson {
  documentId: string | null
  name: string
  workTime: WorkTimeDay | null
  tasksDone: TaskDone[]
}

export interface SmenaSummary {
  date: string
  cash: CashDay | null
  people: SmenaSummaryPerson[]
  /** s265: сообщения передачи смены этого дня */
  handovers?: Handover[]
}

export interface HandoverInput {
  to: string
  text: string
  tasks: { title: string; description: string }[]
  handover: string[]
  note: string
}

export interface HandoverError {
  kind: 'new' | 'handover'
  index?: number
  id?: string
  title?: string
  code: string
  message: string
}

export interface HandoverResult {
  handover: Handover
  created: number
  handedOver: number
  errors: HandoverError[]
  day: SmenaDay
}

export interface CashInput {
  flow: FlowLine[]
  balance: number
  comment: string
  discrepancyReason?: string
  expectedUpdatedAt: string | null
}

export interface WorkTimeInput {
  startTime: string
  endTime: string
  comment: string
  expectedUpdatedAt: string | null
  /** s266: руководство — чьи часы (карточка администраторки) */
  personal?: string
}

/** «Kontrola směny» (s266) — ответ `shift-selfcheck.runSelfCheck`, как у виджета панели Strapi. */
export interface SmenaCheck {
  date: string
  ok: boolean
  problemCount: number
  counts: { services: number; cash: number; workTime: number; calendar: number }
  calendarAvailable: boolean
  flagged: { client: string; master: string; flags: { emoji: string; label: string }[]; staffDelta: number | null; salonDelta: number | null }[]
  calendarOnly: string[]
  strapiOnly: string[]
  serviceMismatch: { client: string; strapi: string; calendar: string }[]
  missing: { services: boolean; cash: boolean; workTime: boolean }
}

/** «Сегодня» руководства (s266); `null` у части — её источник упал. */
export interface SmenaAttention {
  today: string
  missing: { date: string; cash: boolean; workTime: boolean; visits: number; duty: string }[] | null
  discrepancies: { date: string; cashDocId: string; diff: number; reason: string; by: string }[] | null
  handoversUnread: { documentId: string; date: string; fromName: string; toName: string; days: number }[] | null
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Přihlášení vypršelo — přihlaste se znovu.',
  owner_only: 'Tohle může jen vedení salonu.',
  not_allowed: 'Tohle není pro vaši roli.',
  no_card: 'Účet není propojen s kartou zaměstnance — řekněte vedení.',
  stale: 'Záznam mezitím někdo změnil — načtěte ho znovu.',
  shift_closed: 'Směna je uzavřená vedením — opravu udělá vedení.',
  cash_duplicate: 'Za tento den jsou dvě pokladny — opraví vedení.',
}

const smenaFetch = makeApiFetch('/api/engine/admin/smena', CODE_MESSAGES, (status) => `Chyba ${status}`)

export const fetchSmenaDay = (date: string) => smenaFetch<SmenaDay>('GET', `/${encodeURIComponent(date)}`)

export const saveSmenaCash = (date: string, body: CashInput) => smenaFetch<SmenaDay>('PUT', `/${encodeURIComponent(date)}/cash`, body)

export const saveSmenaWorkTime = (date: string, body: WorkTimeInput) => smenaFetch<SmenaDay>('PUT', `/${encodeURIComponent(date)}/work-time`, body)

/** s266: руководство удаляет часы администраторки — `personal` в адресе. */
export const deleteSmenaWorkTime = (date: string, personal?: string) =>
  smenaFetch<SmenaDay>('DELETE', `/${encodeURIComponent(date)}/work-time${personal ? `?personal=${encodeURIComponent(personal)}` : ''}`)

export const fetchSmenaCheck = (date: string) => smenaFetch<SmenaCheck>('GET', `/${encodeURIComponent(date)}/check`)

export const fetchSmenaAttention = () => smenaFetch<SmenaAttention>('GET', '/attention')

export const fetchSmenaSummary = (date: string) => smenaFetch<SmenaSummary>('GET', `/${encodeURIComponent(date)}/summary`)

export const saveHandover = (date: string, body: HandoverInput) => smenaFetch<HandoverResult>('PUT', `/${encodeURIComponent(date)}/handover`, body)

export const readHandover = (id: string) => smenaFetch<{ handover: Handover }>('POST', `/handover/${encodeURIComponent(id)}/read`)

/** Код ошибки → поле формы (подпись под полем, s258). Строки кассы — `flow.sum`/`flow.comment` + индекс. */
export const SMENA_ERROR_FIELD: Record<string, string> = {
  bad_flow: 'flow',
  bad_line: 'flow.sum',
  bad_line_comment: 'flow.comment',
  line_comment_required: 'flow.comment',
  line_reserved: 'flow.comment',
  bad_balance: 'balance',
  cash_mismatch: 'balance',
  later_cash_exists: 'balance',
  lifecycle_rejected: 'balance',
  bad_reason: 'reason',
  bad_comment: 'comment',
  comment_required: 'comment',
  bad_time: 'startTime',
  end_before_start: 'endTime',
  too_long_shift: 'endTime',
  // s266
  personal_required: 'personal',
  bad_personal: 'personal',
  // s265
  bad_recipient: 'to',
  handover_empty: 'text',
  bad_text: 'text',
  bad_note: 'note',
  task_title_required: 'tasks.title',
}

export interface FieldError {
  field: string | null
  index: number | null
  text: string
}

export const smenaFieldError = (e: unknown): FieldError => {
  const code = e instanceof ApiError ? e.code : ''
  const text = e instanceof Error ? e.message : 'Nepodařilo se uložit'
  const d = (e instanceof ApiError ? e.details : null) as { field?: string; index?: number } | null
  return {
    field: d?.field ?? SMENA_ERROR_FIELD[code] ?? null,
    index: typeof d?.index === 'number' ? d.index : null,
    text,
  }
}

/** «12 350 Kč», минус — настоящий «−». */
export const fmtKc = (n: number): string => {
  const v = Math.round(n)
  return `${v < 0 ? '−' : ''}${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Kč`
}

/** «8,5 h». */
export const fmtHours = (h: number): string => `${String(Math.round(h * 100) / 100).replace('.', ',')} h`

/** Часы между слотами «HH:MM» (как сервер; ≤ 0 — null). */
export const hoursOf = (start: string, end: string): number | null => {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null
  const d = m(end) - m(start)
  return d > 0 ? Math.round((d / 60) * 100) / 100 : null
}

/** Ввод суммы: «1 550» / «1550» → 1550; пусто/мусор → null. Только целые кроны. */
export const parseKc = (s: string): number | null => {
  const t = s.replace(/\s/g, '')
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

/** Подсказки описания строки (§8.4) — только подстановка текста. */
export const INCOME_CHIPS = ['Tržba hotově', 'Vklad do pokladny'] as const
export const OUTFLOW_CHIPS = ['Nákup', 'Výběr vedení', 'Drobné výdaje'] as const
/** Типовые задачи смены (§8.6) — дописываются в текст «Co jsem dělal/a». */
export const WORK_CHIPS = ['Recepce a klienti', 'Úklid', 'Nástroje', 'Instagram', 'Telefonáty', 'Sklad'] as const
