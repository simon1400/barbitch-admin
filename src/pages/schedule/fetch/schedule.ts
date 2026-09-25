// Плановый график мастеров (s218, Фаза F плана «Управляющая»).
//
// Шаблон недели мастера + исключения по датам. Сервер (booking-engine/services/
// master-schedule.ts) сам превращает план в блоки календаря «Volno» / «Mimo směnu»
// до конца окна записи и каждый час продлевает — сайт, «Загрузка», «Сегодня» видят
// план только через эти блоки, поэтому никакие кэши сбрасывать не нужно.
//
// Роли: шаблон, исключения и согласование — руководство; администратор только
// ПРЕДЛАГАЕТ изменение дня (действует после согласования); мастеру модуль закрыт.
import { makeApiFetch } from '../../../lib/apiFetch'
import { addDaysYmd, dowOfYmd } from '../../../utils/date'

export type DayState = 'on' | 'off' | 'hours'

export interface Day {
  state: DayState
  from?: number
  to?: number
}

/** Изменение дня: 'template' — убрать исключение, вернуть день шаблону. */
export interface DayChange {
  date: string
  state: DayState | 'template'
  from?: number
  to?: number
}

export type TemplateDays = Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Day>

export interface ScheduleTemplate {
  from: string
  days: TemplateDays
  by?: string
  at?: string
}

export interface CellBlock {
  title: string
  startMin: number
  endMin: number
}

export interface GridCell extends Day {
  /** откуда день: исключение, шаблон или плана нет (работает всё окно) */
  source: 'override' | 'template' | 'none'
  override: { note: string | null; by: string | null } | null
  /** предложение администратора — ждёт согласования, на календарь не влияет */
  request: (Omit<Day, 'state'> & { state: DayState | 'template'; note: string | null; by: string | null; at: string | null }) | null
  /** отпуск / больничный из «Команда → Больничные / отпуска» */
  timeOff: 'sick' | 'vacation' | 'personal' | null
  /** прочие действующие блоки дня (не из плана) */
  blocks: CellBlock[]
  bookings: number
}

export interface GridMaster {
  documentId: string
  name: string
  schedule: { updatedAt: string | null; templates: ScheduleTemplate[] }
  days: Record<string, GridCell>
}

export interface ScheduleGrid {
  month: string
  today: string
  /** последняя дата, на которую открыта запись (часы салона); дальше блоков нет */
  horizon: string | null
  canManage: boolean
  dates: Array<{ date: string; openMin: number | null; closeMin: number | null }>
  masters: GridMaster[]
}

export interface Conflict {
  documentId: string
  date: string
  time: string | null
  client: string | null
  internal: boolean
}

export interface SaveResult {
  updatedAt: string
  pending?: boolean
  reconcile: { created: number; deleted: number }
  conflicts: Conflict[]
  replacedTemplates?: string[]
}

export interface LegacySeries {
  key: string
  kind: 'mirror' | 'own'
  title: string
  count: number
  first: string
  last: string
  weekdays: string[]
  time: string
  createdBy: string | null
  /** блоков этой серии за концом окна записи — остаются, пока план их не перекроет */
  later: number
}

/** Предложение администратора (для «Ke schválení» и «Сегодня»). */
export interface PlanRequest {
  personal: string | null
  employeeName: string
  date: string
  state: DayState | 'template'
  from: number | null
  to: number | null
  label: string
  note: string | null
  by: string | null
  at: string | null
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Сессия истекла — войдите снова.',
  owner_only: 'Это действие — только для руководства салона.',
  management_only: 'Это действие — только для руководства салона.',
  master_not_found: 'Мастер не найден или больше не работает в календаре.',
  bad_month: 'Неверный месяц.',
  bad_state: 'Выберите: выходной, весь день или часы.',
  bad_hours: 'Проверьте часы: шаг 15 минут, конец позже начала.',
  bad_template: 'Заполните все 7 дней шаблона.',
  bad_date: 'Неверная дата.',
  date_in_past: 'Прошедшие дни не меняются.',
  date_too_far: 'Дата слишком далеко в будущем.',
  duplicate_date: 'Дата выбрана дважды.',
  no_changes: 'Не выбрано ни одного дня.',
  too_many_changes: 'Слишком много дней за раз — разбейте на части.',
  note_too_long: 'Заметка слишком длинная.',
  schedule_changed: 'План этого мастера только что изменили в другом окне — нажмите «Обновить».',
  request_not_found: 'Предложения на этот день уже нет — обновите страницу.',
  request_expired: 'День уже прошёл — предложение можно только отклонить.',
  bad_status: 'Неверное решение.',
  legacy_not_covered: 'Серия не покрыта планом или уже удалена — обновите список.',
  no_keys: 'Не выбрано ни одной серии.',
}

const scheduleFetch = makeApiFetch('/api/engine/admin/schedule', CODE_MESSAGES, (s) => `Ошибка ${s}`)

export const fetchScheduleGrid = (month: string) =>
  scheduleFetch<ScheduleGrid>('GET', `?month=${encodeURIComponent(month)}`)

export const previewDays = (personal: string, changes: DayChange[]) =>
  scheduleFetch<{ conflicts: Conflict[] }>('POST', `/${personal}/preview`, { changes })

export const previewTemplate = (personal: string, from: string, days: TemplateDays) =>
  scheduleFetch<{ conflicts: Conflict[] }>('POST', `/${personal}/preview`, { template: { from, days } })

export const saveTemplate = (personal: string, from: string, days: TemplateDays, base: string | null) =>
  scheduleFetch<SaveResult>('PUT', `/${personal}/template`, { from, days, base })

export const saveDays = (personal: string, changes: DayChange[], note: string, base: string | null) =>
  scheduleFetch<SaveResult>('PUT', `/${personal}/days`, { changes, note, base })

export const decideRequest = (personal: string, date: string, status: 'approved' | 'rejected') =>
  scheduleFetch<SaveResult & { status: string }>('POST', `/${personal}/requests/${date}`, { status })

export const fetchLegacy = (personal: string) =>
  scheduleFetch<{ items: LegacySeries[]; horizon: string | null }>('GET', `/${personal}/legacy`)

export const replaceLegacy = (personal: string, keys: string[]) =>
  scheduleFetch<{ deleted: number }>('POST', `/${personal}/legacy`, { keys })

// ── чистые помощники экрана ──

/** Шаблон «работает каждый день» — отправная точка для нового мастера. */
export const allOnTemplate = (): TemplateDays =>
  ({ 0: { state: 'on' }, 1: { state: 'on' }, 2: { state: 'on' }, 3: { state: 'on' }, 4: { state: 'on' }, 5: { state: 'on' }, 6: { state: 'on' } }) as unknown as TemplateDays

/** Шаблон, действующий на дату (последний с from ≤ дата). */
export const templateFor = (templates: ScheduleTemplate[], date: string): ScheduleTemplate | null => {
  let found: ScheduleTemplate | null = null
  for (const t of [...templates].sort((a, b) => a.from.localeCompare(b.from))) if (t.from <= date) found = t
  return found
}

/** Ближайший понедельник после даты (по умолчанию шаблон начинает действовать с него). */
export const nextMonday = (today: string): string => {
  const dow = dowOfYmd(today)
  return addDaysYmd(today, dow === 1 ? 7 : (8 - dow) % 7 || 7)
}

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Короткая подпись дня в клетке: «✓», «—», «12–19». */
export const cellText = (d: { state: DayState | 'template'; from?: number | null; to?: number | null }): string => {
  if (d.state === 'off') return '—'
  if (d.state === 'template') return '↺'
  if (d.state === 'hours' && d.from != null && d.to != null) {
    const short = (m: number) => (m % 60 ? hm(m) : String(m / 60))
    return `${short(d.from)}–${short(d.to)}`
  }
  return '✓'
}

/** Подпись дня словами. */
export const dayWords = (d: { state: DayState | 'template'; from?: number | null; to?: number | null }): string => {
  if (d.state === 'off') return 'выходной'
  if (d.state === 'template') return 'как в шаблоне'
  if (d.state === 'hours' && d.from != null && d.to != null) return `${hm(d.from)}–${hm(d.to)}`
  return 'весь день'
}

/** Варианты часов в выпадающем списке: 08:00 … 22:00, шаг 15 минут. */
export const HOUR_OPTIONS: number[] = Array.from({ length: (22 - 8) * 4 + 1 }, (_, i) => 8 * 60 + i * 15)
export { hm as fmtMin }

export const TIME_OFF_SHORT: Record<string, string> = { sick: 'Б', vacation: 'О', personal: 'Л' }
export const TIME_OFF_WORDS: Record<string, string> = { sick: 'больничный', vacation: 'отпуск', personal: 'личное' }

/** Порядок дней в шаблоне: Пн … Вс; ключ — как getUTCDay (0 = Вс). */
export const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const
export const DOW_SHORT: Record<string, string> = { '0': 'Вс', '1': 'Пн', '2': 'Вт', '3': 'Ср', '4': 'Чт', '5': 'Пт', '6': 'Сб' }
