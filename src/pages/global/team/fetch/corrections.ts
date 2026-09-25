// Корректировки зарплат (s215, Фаза C плана «Управляющая»): штрафы, доп. заработок,
// списания, авансы, выплаты, налоги — из админки, а не из Strapi CM.
//
// Пишет только серверная ручка движка (`/engine/admin/corrections`, руководство):
// она публикует запись, как CM, и пишет журнал. Сырой `/api/<коллекция>` здесь
// не используется — без журнала не видно, кто и когда завёл штраф.
//
// 🟥 Итоги месяца кэшируются (прошлый месяц — навсегда, monthDataCache), поэтому
// после записи/удаления сбрасывается кэш месяца ДАТЫ записи — иначе «Зарплаты»
// показывали бы старую сумму до ручного «Обновить».
import { makeApiFetch } from '../../../../lib/apiFetch'
import { invalidateGlobalMonthData } from '../../../dashboard/fetch/monthDataCache'
import { kc } from '../../../../utils/money'
import { monthEndYmd } from '../../../../utils/date'

export type CorrectionKind = 'penalty' | 'add-money' | 'payroll' | 'avans' | 'salary' | 'tax'

export interface CorrectionKindMeta {
  label: string
  /** как запись влияет на выплату: '−' уменьшает начисленное, '+' добавляет, 'выплачено' — уже выдано */
  effect: string
  /** без комментария сервер не примет (за что штраф / премия / списание) */
  textRequired: boolean
  textLabel: string
}

// Порядок — порядок селекта в форме.
export const CORRECTION_KINDS: Record<CorrectionKind, CorrectionKindMeta> = {
  penalty: { label: 'Штраф', effect: '−', textRequired: true, textLabel: 'За что' },
  'add-money': { label: 'Доп. заработок', effect: '+', textRequired: true, textLabel: 'За что' },
  payroll: { label: 'Списание с зарплаты', effect: '−', textRequired: true, textLabel: 'За что' },
  avans: { label: 'Аванс', effect: 'выдано', textRequired: false, textLabel: 'Комментарий' },
  salary: { label: 'Выплата зарплаты', effect: 'выдано', textRequired: false, textLabel: 'Комментарий' },
  tax: { label: 'Налоги', effect: 'за сотрудника', textRequired: false, textLabel: 'Комментарий' },
}

/** Вид налога — enum `tax.type` схемы Strapi. Порядок — порядок селекта. */
export type TaxType = 'all' | 'social' | 'health' | 'income'
export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  all: 'все налоги',
  social: 'соц. страхование',
  health: 'мед. страхование',
  income: 'подоходный',
}

export const KIND_ORDER = Object.keys(CORRECTION_KINDS) as CorrectionKind[]

/** Откуда взялась запись движка — подпись вместо кнопки «Удалить». */
export const SOURCE_LABELS: Record<string, string> = {
  upsell: 'комиссия за дозапись',
  internal: 'интерная услуга',
  korekce: 'коррекция',
}

export interface CorrectionRow {
  kind: CorrectionKind
  documentId: string
  date: string | null
  sum: number
  text: string
  /** только у налога: вид (enum схемы) */
  taxType: TaxType | null
  personal: { documentId: string; name: string } | null
  source: string | null
  /** нет опубликованной версии — в зарплаты ещё не попала */
  draft: boolean
  /** запись ведёт движок (source) — удалить нельзя */
  readOnly: boolean
  createdAt: string | null
}

export interface CorrectionInput {
  kind: CorrectionKind
  personal: string
  date: string
  sum: number
  text: string
  /** обязателен у налога, у остальных не отправляется */
  taxType?: TaxType
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Корректировки доступны только руководству салона.',
  unauthorized: 'Сессия истекла — войдите снова.',
  bad_kind: 'Неизвестный тип корректировки.',
  personal_required: 'Выберите сотрудника.',
  personal_not_found: 'Сотрудник не найден.',
  bad_date: 'Неверная дата.',
  date_too_far: 'Дата слишком далеко в будущем.',
  bad_sum: 'Сумма — целое положительное число крон.',
  sum_too_big: 'Слишком большая сумма — проверьте, нет ли лишнего нуля.',
  text_required: 'Напишите, за что.',
  text_too_long: 'Комментарий слишком длинный (до 500 символов).',
  correction_not_found: 'Запись уже удалена.',
  correction_engine_owned: 'Эту запись ведёт календарь — удалить её здесь нельзя.',
  bad_month: 'Неверный месяц.',
  bad_tax_type: 'Выберите вид налога.',
}

const correctionsFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

const pad2 = (n: number) => String(n).padStart(2, '0')

/** month — 0-based, как у useMonthYear. */
export const monthKey = (month: number, year: number) => `${year}-${pad2(month + 1)}`

export const fetchCorrections = async (month: number, year: number, personal?: string): Promise<CorrectionRow[]> => {
  const q = `month=${monthKey(month, year)}${personal ? `&personal=${encodeURIComponent(personal)}` : ''}`
  const res = await correctionsFetch<{ rows: CorrectionRow[] }>('GET', `/corrections?${q}`)
  return Array.isArray(res?.rows) ? res.rows : []
}

// Кэш итогов месяца — по дате записи (она может быть вне открытого месяца).
const invalidateMonthOf = (ymd: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(ymd ?? ''))
  if (m) invalidateGlobalMonthData(Number(m[2]) - 1, Number(m[1]))
}

export const createCorrection = async (input: CorrectionInput): Promise<CorrectionRow> => {
  const res = await correctionsFetch<{ row: CorrectionRow }>('POST', '/corrections', input)
  invalidateMonthOf(input.date)
  return res.row
}

export const deleteCorrection = async (row: Pick<CorrectionRow, 'kind' | 'documentId' | 'date'>): Promise<void> => {
  await correctionsFetch('DELETE', `/corrections/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.documentId)}`)
  invalidateMonthOf(row.date)
}

/** Подпись суммы: штраф/списание «−», доп. заработок «+», аванс/выплата без знака (уже выдано). */
export const sumLabel = (row: Pick<CorrectionRow, 'kind' | 'sum'>): string => {
  if (!row.sum) return kc(0)
  const e = CORRECTION_KINDS[row.kind]?.effect
  return `${e === '−' ? '−' : e === '+' ? '+' : ''}${kc(row.sum)}`
}

/** Дата формы по умолчанию: сегодня, если открыт текущий месяц; иначе последний день прошлого / первый будущего. */
export const defaultDateFor = (month: number, year: number, today: string): string => {
  const key = monthKey(month, year)
  if (today.startsWith(key)) return today
  return key < today.slice(0, 7) ? monthEndYmd(year, month) : `${key}-01`
}

/** Итог по типам за видимые строки (черновики не считаются — в зарплатах их нет). */
export const totalsByKind = (rows: CorrectionRow[]): Record<CorrectionKind, number> => {
  const t = { penalty: 0, 'add-money': 0, payroll: 0, avans: 0, salary: 0, tax: 0 } as Record<CorrectionKind, number>
  for (const r of rows) if (!r.draft && r.kind in t) t[r.kind] += r.sum
  return t
}
