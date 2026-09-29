// Карточка сотрудника (s226, шаг 5 плана STAFF_CARD_NEXT_SESSION_PROMPT.md).
// Всё — ручки движка `/engine/admin/staff…` (только руководство: owner + manager).
// Прямой REST в `personals` / `admin-users` для этого экрана закрыт middleware (s223).
//
// 🟥 Личные данные (`/private`) грузятся ОТДЕЛЬНЫМ запросом только при раскрытии
// секции — в список и шапку карточки они не приходят. Ключ ответа — `private`
// (admin-session вырезает `oficial` из любых ответов).
//
// Запись секций — с `base` = `updatedAt` карточки, от которой шла правка: сервер
// отвечает 409 `staff_changed`, если карточку успели поменять в другом окне.
import { API_URL } from '../../../../lib/config'
import { ApiError, makeApiFetch } from '../../../../lib/apiFetch'
import { getToken } from '../../../../services/auth'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../../utils/date'
import { kcNum } from '../../../../utils/money'
import { invalidateGlobalMonthData } from '../../../dashboard/fetch/monthDataCache'
import { invalidatePayrollGroups } from '../../../dashboard/fetch/payrollGroups'

export type Position = 'master' | 'administrator' | 'manager'
export type Tier = 'senior' | 'junior'
export type TypeWork = 'hpp' | 'dpp'
export type DocKind = 'passport' | 'residence' | 'health' | 'contract' | 'license' | 'other'
export type StaffFlag =
  | 'no_account'
  | 'account_disabled'
  | 'not_in_calendar'
  | 'no_services'
  | 'no_schedule'
  | 'no_rate'

export interface StaffPhoto {
  id: number | null
  url: string
  thumb: string
}

export interface StaffRow {
  documentId: string
  name: string
  position: Position | null
  tier: Tier
  isActive: boolean
  /** ушёл: isActive=false или «❌» в имени */
  left: boolean
  published: boolean
  photo: StaffPhoto | null
  hiredAt: string | null
  leftAt: string | null
  servicesCount: number
  account: { id: number; role: string; isActive: boolean } | null
  flags: StaffFlag[]
  /** заполненность (фаза 2): только процент и число невыполненных; ушедшим null; нет — старый сервер */
  checklist?: { percent: number; open: number } | null
  /** тип текущего договора */
  contract?: ContractType | null
}

export type ContractType = 'hpp' | 'dpp' | 'ico'

/** Договор — только учёт (фаза 2): на ставки и зарплаты не влияет. */
export interface StaffContract {
  /** id компонента — для правки / удаления */
  id: number | null
  type: ContractType
  from: string
  to: string | null
  probationUntil: string | null
  ico: string | null
  note: string | null
}

/** Пункт чек-листа: автоматический (`key`) или свой пункт руководства (`itemId`). */
export interface ChecklistItem {
  key?: string
  itemId?: string
  title: string
  auto: boolean
  done: boolean
  /** автопункт: куда вести в карточке */
  section?: 'account' | 'private' | 'header' | 'documents' | 'contract' | 'pay' | 'booking'
  doneAt?: string | null
  doneBy?: string | null
  /** свой пункт выключен в каталоге (остался, потому что отмечен) */
  active?: boolean
}

export interface StaffChecklist {
  items: ChecklistItem[]
  percent: number
  open: number
}

/** Свой пункт в каталоге «Настроить пункты». */
export interface ChecklistCatalogItem {
  documentId: string
  title: string
  positions: Position[]
  order: number
  active: boolean
}

export interface StaffRate {
  typeWork: TypeWork
  rate: number | null
  hourlyRate: number | null
  from: string | null
  to: string | null
}

export interface StaffAccount {
  id: number
  username: string
  role: string
  isActive: boolean
  /** учётка связана с карточкой (s229); false — найдена по совпадению имени */
  linked?: boolean
}

export interface StaffNote {
  documentId: string
  text: string
  authorName: string
  createdAt: string | null
  updatedAt: string | null
  canEdit: boolean
}

export interface StaffHistoryItem {
  action: string
  actorName: string
  summary: string
  details: Record<string, string> | null
  createdAt: string | null
}

export interface StaffCard {
  documentId: string
  name: string
  position: Position | null
  tier: Tier
  isActive: boolean
  left: boolean
  published: boolean
  /** версия для записи (`base`) */
  updatedAt: string
  /** это карточка того, кто сейчас вошёл */
  self: boolean
  photo: StaffPhoto | null
  hiredAt: string | null
  leftAt: string | null
  /** только у ушедших: с какой даты можно стереть личные данные */
  erase: { dueAt: string | null; due: boolean; erasedAt: string | null } | null
  booking: {
    noonaEmployeeId: string | null
    calendarOrder: number
    bookingPriority: number
    servicesCount: number
    hasSchedule: boolean
  }
  pay: {
    ratePercent: number | null
    excessThreshold: number
    rates: StaffRate[]
    currentRate: StaffRate | null
    /** зарплатная группа (s229, §5а.2); нет — старый сервер */
    group?: PayrollGroup
  }
  account: StaffAccount | null
  /** ключи незаполненных личных полей (без значений) */
  privateMissing: string[]
  documentsCount: number
  nextTimeOff: { type: string; startDate: string; endDate: string } | null
  notes: StaffNote[]
  history: StaffHistoryItem[]
  flags: StaffFlag[]
  /** договоры (фаза 2); нет — старый сервер */
  contracts?: { list: StaffContract[]; current: StaffContract | null }
  /** онбординг-чек-лист; ушедшим null; нет — старый сервер */
  checklist?: StaffChecklist | null
}

export const PRIVATE_KEYS = [
  'name',
  'dateBirth',
  'addressInCz',
  'addressInHome',
  'documentNumber',
  'phone',
  'email',
  'bankAccount',
  'emergencyName',
  'emergencyPhone',
] as const
export type PrivateKey = (typeof PRIVATE_KEYS)[number]
export type PrivateValues = Record<PrivateKey, string>

export interface StaffDocument {
  documentId: string
  kind: DocKind
  title: string
  validUntil: string | null
  fileName: string
  mime: string
  size: number
  uploadedBy: string
  createdAt: string | null
}

export interface StaffPrivate {
  documentId: string
  updatedAt: string
  private: PrivateValues & { dateBirthYmd: string | null }
  missing: string[]
  documents: StaffDocument[]
  /** старые сканы из панели Strapi (ImageKit) — до переноса в закрытый каталог */
}

export interface BookingRef {
  documentId: string
  date: string
  time: string | null
  client: string | null
  internal: boolean
}

export interface LeavePreview {
  documentId: string
  name: string
  updatedAt: string
  today: string
  hiredAt: string | null
  bookings: BookingRef[]
  planBlocks: number
  openRates: StaffRate[]
  account: StaffAccount | null
  blockers: ('staff_left' | 'self_leave' | 'owner_account' | 'future_bookings')[]
}

// ── подписи ────────────────────────────────────────────────────────────────

export const POSITION_LABEL: Record<Position, string> = {
  master: 'Мастер',
  administrator: 'Администратор',
  manager: 'Управляющая',
}

export const positionLabel = (p: Position | null | undefined): string => (p ? POSITION_LABEL[p] : 'должность не указана')

export const ROLE_LABEL: Record<string, string> = {
  owner: 'владелец',
  manager: 'управляющая',
  administrator: 'администратор',
  master: 'мастер',
}

export const FLAG_LABEL: Record<StaffFlag, string> = {
  no_account: 'нет учётки',
  account_disabled: 'вход отключён',
  not_in_calendar: 'не в календаре',
  no_services: 'нет услуг',
  no_schedule: 'нет графика',
  no_rate: 'ставка не задана',
}

export const CONTRACT_LABEL: Record<ContractType, string> = { hpp: 'HPP', dpp: 'DPP', ico: 'IČO' }
export const CONTRACT_TYPES = Object.keys(CONTRACT_LABEL) as ContractType[]
export const CONTRACT_HINT: Record<ContractType, string> = {
  hpp: 'pracovní smlouva',
  dpp: 'dohoda o provedení práce',
  ico: 'OSVČ, živnostenský list',
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  passport: 'Паспорт',
  residence: 'Вид на жительство',
  health: 'Zdravotní průkaz',
  contract: 'Договор',
  license: 'Živnostenský list',
  other: 'Другое',
}
export const DOC_KINDS = Object.keys(DOC_KIND_LABEL) as DocKind[]

export const PRIVATE_LABEL: Record<PrivateKey, string> = {
  name: 'Официальное имя',
  dateBirth: 'Дата рождения',
  addressInCz: 'Адрес в Чехии',
  addressInHome: 'Адрес на родине',
  documentNumber: 'Номер документа',
  phone: 'Телефон',
  email: 'E-mail',
  bankAccount: 'Номер счёта',
  emergencyName: 'Экстренный контакт — имя',
  emergencyPhone: 'Экстренный контакт — телефон',
}

export const TIME_OFF_LABEL: Record<string, string> = {
  sick: 'больничный',
  vacation: 'отпуск',
  personal: 'личный',
}

/** Действия журнала по карточке → подпись. */
export const HISTORY_LABEL: Record<string, string> = {
  staff_create: 'Создан',
  staff_update: 'Изменено',
  staff_rate: 'Ставка',
  staff_file_add: 'Файл добавлен',
  staff_file_update: 'Документ изменён',
  staff_file_delete: 'Документ удалён',
  staff_note: 'Заметка',
  staff_account: 'Учётка',
  staff_rename: 'Переименование',
  staff_leave: 'Завершил(а) работу',
  staff_erase: 'Личные данные стёрты',
  staff_contract: 'Договор',
  staff_onboarding: 'Онбординг',
}

// ── запросы ────────────────────────────────────────────────────────────────

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Карточки сотрудников — только для руководства салона.',
  unauthorized: 'Сессия истекла — войдите снова.',
  staff_not_found: 'Сотрудник не найден.',
  staff_changed: 'Карточку только что изменили в другом окне — нажмите «Обновить».',
  base_required: 'Обновите карточку и повторите.',
  nothing_to_save: 'Нечего сохранять.',
  bad_position: 'Выберите должность.',
  bad_tier: 'Уровень junior — только у мастера.',
  bad_percent: 'Доля мастера — целое число от 0 до 100.',
  bad_threshold: 'Порог — целое число от 0.',
  bad_priority: 'Приоритет — целое число.',
  bad_email: 'Неверный e-mail.',
  bad_bank: 'Номер счёта — цифры, «-», «/» или IBAN.',
  bad_birth: 'Проверьте дату рождения.',
  not_master: 'Приоритет записи — только у мастеров.',
  self_position: 'Свою должность менять нельзя — вместе с ней сменится ваша роль входа.',
  owner_account: 'Учётка владельца из карточки не меняется.',
  // future_bookings — без подмены: сервер называет число броней, список — в details
  bad_type_work: 'Тип договора — HPP или DPP.',
  hourly_only_hpp: 'Отдельная почасовая ставка — только у HPP.',
  rate_in_past: 'Ставка вводится не раньше первого числа текущего месяца — прошлые месяцы уже посчитаны.',
  // rate_overlap / rate_after_leave / erase_too_early — без подмены: сервер называет дату
  date_too_far: 'Дата слишком далеко в будущем.',
  file_required: 'Выберите один файл.',
  file_empty: 'Файл пустой.',
  file_too_big: 'Файл больше 10 МБ.',
  bad_file_type: 'Поддерживаются JPG, PNG, WEBP и PDF.',
  photo_not_image: 'Фото — JPG, PNG или WEBP.',
  bad_kind: 'Неизвестный тип документа.',
  title_required: 'Укажите название документа.',
  storage_not_configured: 'Хранилище документов на сервере не настроено — обратитесь к разработчику.',
  file_not_found: 'Документ не найден.',
  file_missing: 'Файл документа на сервере не найден.',
  note_required: 'Текст заметки пустой.',
  note_not_found: 'Заметка уже удалена.',
  note_not_yours: 'Менять заметку может только её автор или владелец.',
  name_required: 'Укажите имя.',
  name_taken: 'Сотрудник или логин с таким именем уже есть.',
  self_rename: 'Себя переименовать нельзя — сменится ваш логин.',
  account_exists: 'У сотрудника уже есть учётка.',
  account_not_found: 'У сотрудника нет учётки.',
  self_account: 'Свою учётку отключить нельзя.',
  staff_left: 'Сотрудник уже завершил работу.',
  self_leave: 'Себе завершить работу нельзя.',
  leave_in_future: 'Дата ухода — не позже сегодняшней: завершите работу в последний день.',
  staff_not_left: 'Сотрудник ещё работает: уход ставится действием «Завершить работу», стирание — только у ушедших.',
  left_at_missing: 'Не указана дата ухода.',
  confirm_mismatch: 'Для подтверждения введите имя сотрудника точно.',
  bad_dual_role: 'Совместитель — да или нет.',
  not_manager: 'Оклад управляющей — только у должности «управляющая».',
  bad_contract_type: 'Тип договора — HPP, DPP или IČO.',
  probation_only_hpp: 'Испытательный срок — только у HPP.',
  ico_required: 'Укажите IČO.',
  bad_ico: 'IČO — 8 цифр с верной контрольной цифрой.',
  ico_only_ico: 'IČO — только у договора IČO (OSVČ).',
  contract_started: 'Начавшийся договор не удаляется — закройте его датой.',
  contract_not_found: 'Договор не найден — обновите карточку.',
  item_not_found: 'Пункт не найден — обновите карточку.',
  item_exists: 'Такой пункт уже есть.',
  item_inactive: 'Пункт выключен — включите его в «Настроить пункты».',
  bad_positions: 'Выберите, кому пункт: мастер, администратор, управляющая.',
  // contract_overlap — без подмены: сервер называет договор, с которым пересечение
  // bad_name / bad_date / bad_phone / too_long / bad_field / bad_rate / bad_hourly — без подмены:
  // сервер называет поле и границы
}

const staffFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

const enc = encodeURIComponent

export const fetchStaffList = () => staffFetch<{ today: string; rows: StaffRow[] }>('GET', '/staff')

export const fetchStaffCard = (id: string) => staffFetch<StaffCard>('GET', `/staff/${enc(id)}`)

/** Напоминания руководству на «Сегодня» (s227): сроки документов, стирание через 3 года. */
export interface StaffReminders {
  today: string
  horizonDays: number
  /** документы работающих: срок кончается в horizonDays дней или уже прошёл (daysLeft < 0) */
  documents: {
    personal: string
    name: string
    documentId: string
    kind: DocKind
    title: string
    validUntil: string
    daysLeft: number
  }[]
  /** ушедшие, у кого прошло 3 года, а личные данные не стёрты */
  erase: { personal: string; name: string; leftAt: string; dueAt: string }[]
  /** ушедшие с личными данными без даты ухода — срок стирания не считается */
  leftWithoutDate: { personal: string; name: string }[]
  /** договоры (фаза 2): конец ≤ 30 дней или истёк без нового; испытательный ≤ 14 дней; нет — старый сервер */
  contracts?: {
    personal: string
    name: string
    kind: 'contract_end' | 'probation_end'
    type: ContractType
    date: string
    daysLeft: number
  }[]
}

export const fetchStaffReminders = () => staffFetch<StaffReminders>('GET', '/staff-reminders')

export const fetchStaffPrivate = (id: string) => staffFetch<StaffPrivate>('GET', `/staff/${enc(id)}/private`)

type Unchanged = { unchanged: boolean }

export const patchStaff = (
  id: string,
  section: 'basic' | 'booking' | 'pay',
  data: Record<string, unknown>,
  base: string,
) => staffFetch<StaffCard & Unchanged>('PATCH', `/staff/${enc(id)}`, { section, data, base })

export const patchStaffPrivate = (id: string, data: Partial<PrivateValues>, base: string) =>
  staffFetch<StaffPrivate & Unchanged>('PATCH', `/staff/${enc(id)}`, { section: 'private', data, base })

/** Зарплатная группа карточки: совместитель (мастер + администратор) и управляющая. */
export interface PayrollGroup {
  dualRole: boolean
  /** последний месяц совмещения 'YYYY-MM'; null — бессрочно */
  dualRoleUntil: string | null
  /** первый месяц управляющей 'YYYY-MM'; null — не управляющая */
  managerSince: string | null
}

/**
 * Правка зарплатной группы (s229). Меняет расчёт зарплат всех месяцев, где группа
 * действует, — поэтому после сохранения сбрасываются группы и кэш месяцев.
 */
export const savePayrollGroup = async (
  id: string,
  data: Partial<PayrollGroup>,
  base: string,
): Promise<StaffCard & Unchanged> => {
  const res = await patchStaff(id, 'pay', data, base)
  invalidatePayrollGroups()
  invalidateGlobalMonthData()
  return res
}

/** 'YYYY-MM' → 'MM.YYYY' */
export const fmtYm = (ym: string | null | undefined): string => (ym ? `${ym.slice(5, 7)}.${ym.slice(0, 4)}` : '')

export interface RateInput {
  typeWork: TypeWork
  rate: number | string
  hourlyRate?: number | string | null
  from: string
}

export const addStaffRate = (id: string, input: RateInput, base: string) =>
  staffFetch<StaffCard>('POST', `/staff/${enc(id)}/rates`, { ...input, base })

export const updateStaffDocument = (
  id: string,
  fileId: string,
  data: { kind?: DocKind; title?: string; validUntil?: string | null },
) => staffFetch<{ document: StaffDocument }>('PATCH', `/staff/${enc(id)}/files/${enc(fileId)}`, data)

export const deleteStaffDocument = (id: string, fileId: string) =>
  staffFetch<{ deleted: string }>('DELETE', `/staff/${enc(id)}/files/${enc(fileId)}`)

export const addStaffNote = (id: string, text: string) =>
  staffFetch<{ notes: StaffNote[] }>('POST', `/staff/${enc(id)}/notes`, { text })

export const updateStaffNote = (id: string, noteId: string, text: string) =>
  staffFetch<{ notes: StaffNote[] }>('PATCH', `/staff/${enc(id)}/notes/${enc(noteId)}`, { text })

export const deleteStaffNote = (id: string, noteId: string) =>
  staffFetch<{ notes: StaffNote[] }>('DELETE', `/staff/${enc(id)}/notes/${enc(noteId)}`)

export interface CreateStaffInput {
  name: string
  position: Position
  tier?: Tier
  hiredAt?: string
  ratePercent?: number | string
  rate?: RateInput
  private?: Partial<PrivateValues>
  account?: boolean
}

/** Пароль приходит один раз — в ответе создания / сброса. */
export const createStaff = (input: CreateStaffInput) =>
  staffFetch<StaffCard & { password: string | null }>('POST', '/staff', input)

export type AccountAction = 'create' | 'disable' | 'enable' | 'reset_password'

export const staffAccountAction = (id: string, action: AccountAction) =>
  staffFetch<StaffCard & Unchanged & { password: string | null }>('POST', `/staff/${enc(id)}/account`, { action })

export const renameStaff = (id: string, name: string, base: string) =>
  staffFetch<StaffCard & Unchanged & { accountRenamed?: boolean }>('POST', `/staff/${enc(id)}/rename`, {
    name,
    base,
  })

export const fetchLeavePreview = (id: string) => staffFetch<LeavePreview>('GET', `/staff/${enc(id)}/leave`)

export const leaveStaff = (id: string, leftAt: string, base: string) =>
  staffFetch<StaffCard & { planBlocksDeleted: number }>('POST', `/staff/${enc(id)}/leave`, { leftAt, base })

export const eraseStaff = (id: string, confirmName: string, base: string) =>
  staffFetch<StaffCard & { erased: { documents: number; notes: number } }>(
    'POST',
    `/staff/${enc(id)}/erase`,
    { confirmName, base },
  )

// ── фаза 2: договоры, онбординг ────────────────────────────────────────────

export interface ContractInput {
  type?: ContractType
  from?: string
  to?: string | null
  probationUntil?: string | null
  ico?: string | null
  note?: string | null
}

type Warned = { warnings?: 'long_probation'[] }

export const addStaffContract = (id: string, input: ContractInput, base: string) =>
  staffFetch<StaffCard & Warned>('POST', `/staff/${enc(id)}/contracts`, { ...input, base })

export const updateStaffContract = (id: string, contractId: number, input: ContractInput, base: string) =>
  staffFetch<StaffCard & Warned & Unchanged>('PATCH', `/staff/${enc(id)}/contracts/${contractId}`, { ...input, base })

export const deleteStaffContract = (id: string, contractId: number, base: string) =>
  staffFetch<StaffCard>('DELETE', `/staff/${enc(id)}/contracts/${contractId}?base=${enc(base)}`)

export const setStaffOnboarding = (id: string, itemId: string, done: boolean) =>
  staffFetch<StaffCard & Unchanged>('POST', `/staff/${enc(id)}/onboarding/${enc(itemId)}`, { done })

export const fetchChecklistCatalog = () => staffFetch<{ items: ChecklistCatalogItem[] }>('GET', '/staff-checklist-items')

export const createChecklistItem = (title: string, positions: Position[]) =>
  staffFetch<{ items: ChecklistCatalogItem[] }>('POST', '/staff-checklist-items', { title, positions })

export const updateChecklistItem = (
  itemId: string,
  data: Partial<Pick<ChecklistCatalogItem, 'title' | 'positions' | 'active' | 'order'>>,
) => staffFetch<{ items: ChecklistCatalogItem[] }>('PATCH', `/staff-checklist-items/${enc(itemId)}`, data)

/** «HPP 01.10.2026 – 30.09.2027», «DPP с 01.10.2026». */
export const contractText = (c: Pick<StaffContract, 'type' | 'from' | 'to'> | null | undefined): string => {
  if (!c) return '—'
  return `${CONTRACT_LABEL[c.type] ?? c.type} ${c.to ? `${fmtCsDate(c.from)} – ${fmtCsDate(c.to)}` : `с ${fmtCsDate(c.from)}`}`
}

/**
 * Подсказка в «Оплате»: тип текущей ставки не совпадает с договором. Только подсказка —
 * договор ставки не меняет (🟥 `typeWork` несёт смысл оплаты). IČO — без подсказки.
 */
export const contractMismatch = (rate: StaffRate | null | undefined, contract: StaffContract | null | undefined): boolean =>
  Boolean(rate && contract && contract.type !== 'ico' && rate.typeWork !== contract.type)

/** Брони из ответа 409 `future_bookings` (сервер кладёт их в error.details). */
export const bookingsOf = (e: unknown): BookingRef[] => {
  const details = e instanceof ApiError ? (e.details as { bookings?: unknown } | undefined) : undefined
  const rows = details?.bookings
  return Array.isArray(rows) ? (rows as BookingRef[]) : []
}

// ── файлы: свой fetch (multipart / поток) ──────────────────────────────────

const failFrom = async (res: Response): Promise<never> => {
  const json = await res.json().catch(() => null)
  const code = json?.error?.code || 'internal'
  throw new ApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Ошибка ${res.status}`)
}

export interface UploadInput {
  target: 'photo' | 'document'
  file: File
  kind?: DocKind
  title?: string
  validUntil?: string
}

/**
 * Загрузка файла. Поле файла — `files` (так Strapi сам чистит временный файл);
 * Content-Type не ставим — браузер допишет boundary сам.
 * Фото → свежая карточка; документ → `{document}`.
 */
export const uploadStaffFile = async (id: string, input: UploadInput): Promise<StaffCard | { document: StaffDocument }> => {
  const fd = new FormData()
  fd.append('target', input.target)
  if (input.kind) fd.append('kind', input.kind)
  if (input.title) fd.append('title', input.title)
  if (input.validUntil) fd.append('validUntil', input.validUntil)
  fd.append('files', input.file, input.file.name)
  const res = await fetch(`${API_URL}/api/engine/admin/staff/${enc(id)}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    body: fd,
  })
  if (!res.ok) return failFrom(res)
  return res.json()
}

/**
 * Скан — только через fetch с Bearer (ссылкой `<a href>` нельзя: у неё нет заголовка).
 * Возвращает objectURL; освобождать через `URL.revokeObjectURL`.
 */
export const downloadStaffFile = async (id: string, fileId: string): Promise<string> => {
  const res = await fetch(`${API_URL}/api/engine/admin/staff/${enc(id)}/files/${enc(fileId)}`, {
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    cache: 'no-store',
  })
  if (!res.ok) return failFrom(res)
  return URL.createObjectURL(await res.blob())
}

/** Максимальный размер файла (сервер проверяет то же). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPT_DOC = 'image/jpeg,image/png,image/webp,application/pdf'
export const ACCEPT_PHOTO = 'image/jpeg,image/png,image/webp'

// ── чистые функции ─────────────────────────────────────────────────────────

export type ListFilter = 'active' | 'left' | 'all'

/**
 * Фильтр списка: работают / ушли / все + должность (+ «не заполнены» — чек-лист не закрыт).
 * Порядок — как с сервера (по имени).
 */
export const filterStaff = (rows: StaffRow[], status: ListFilter, position: Position | 'all', incomplete = false): StaffRow[] =>
  rows.filter(
    (r) =>
      (status === 'all' || (status === 'left' ? r.left : !r.left)) &&
      (position === 'all' || r.position === position) &&
      (!incomplete || Boolean(r.checklist && r.checklist.open > 0)),
  )

/** «1,2 МБ», «340 КБ». */
export const fmtSize = (bytes: number): string => {
  if (!bytes) return '—'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`
}

const DAY_MS = 86_400_000
const utc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS)

/** Срок документа: просрочен / истекает в 30 дней / в порядке / без срока. */
export const validity = (
  validUntil: string | null,
  today: string,
): { state: 'none' | 'ok' | 'soon' | 'expired'; days: number | null } => {
  if (!validUntil) return { state: 'none', days: null }
  const days = daysBetween(today, validUntil)
  if (days < 0) return { state: 'expired', days }
  if (days <= 30) return { state: 'soon', days }
  return { state: 'ok', days }
}

/** «DPP 180 Kč/h», «HPP 19 011 Kč/měs + 150 Kč/h» — как пишет журнал сервера. */
export const rateText = (r: StaffRate | null | undefined): string => {
  if (!r) return '—'
  const n = (v: number | null) => (v == null ? '—' : kcNum(v))
  if (r.typeWork === 'hpp') return `HPP ${n(r.rate)} Kč/měs${r.hourlyRate ? ` + ${n(r.hourlyRate)} Kč/h` : ''}`
  return `DPP ${n(r.rate)} Kč/h`
}

/** Метка времени заметки / записи журнала: «28.09.2026 14:05» (пражское время). */
export const fmtWhen = (iso: string | null): string => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '')

/** Первое число текущего месяца — раньше ставку ввести нельзя (прошлые месяцы посчитаны). */
export const monthStartOf = (ymd: string): string => `${ymd.slice(0, 7)}-01`

/** Имя как на сервере: пробелы схлопнуты и обрезаны. */
export const cleanName = (v: string): string => v.replace(/\s+/g, ' ').trim()

/** Изменённые поля личных данных (для PATCH шлём только их). */
export const privateDiff = (saved: PrivateValues, draft: PrivateValues): Partial<PrivateValues> => {
  const out: Partial<PrivateValues> = {}
  for (const k of PRIVATE_KEYS) if ((draft[k] ?? '').trim() !== (saved[k] ?? '').trim()) out[k] = draft[k].trim()
  return out
}

/** ГГГГ-ММ-ДД поля даты → строка карточки ДД.ММ.ГГГГ (так её читают «Дни рождения»). */
export const ymdToBirth = (ymd: string): string => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}` : '')
