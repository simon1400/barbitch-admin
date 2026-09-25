// Смены администраторов (s217, Фаза E плана «Управляющая»): график недели
// «кто дежурит» — коллекция shift («Рабочие смены»). Раньше — только Strapi CM.
// Чтение и запись — ручки движка `/engine/admin/shifts` (руководство): они же
// публикуют неделю и пишут журнал. Календарь, «Сегодня» и отчёт дозаписей
// читают тот же график (fetchAdminRoster, status=draft) — сброс кэша не нужен.
//
// Значение дня — свободный текст («Вика», «Юля», «-», «Ремонт»): связи с
// карточкой сотрудника в схеме нет, строка только показывается.
import { addDaysYmd, mondayOfYmd } from '../../../../utils/date'
import { makeApiFetch } from '../../../../lib/apiFetch'

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type DayKey = (typeof DAY_KEYS)[number]
export type WeekDays = Record<DayKey, string>

export const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
}

export interface ShiftWeek {
  monday: string
  sunday: string
  /** null — графика на эту неделю ещё нет */
  documentId: string | null
  days: WeekDays | null
  published: boolean
  /** версия, от которой идёт правка (сервер сверяет — защита от одновременной правки) */
  updatedAt: string | null
  /** на эту неделю в базе две записи — сохранять нельзя, чинится в Strapi */
  duplicate: boolean
}

export interface ShiftWindow {
  weeks: ShiftWeek[]
  /** имена из недавних недель, частые сверху — варианты для выбора */
  names: string[]
}

/** Сколько недель показывает экран. */
export const WINDOW_WEEKS = 5
/** Длина значения дня (сервер проверяет то же). */
export const MAX_NAME = 60

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'График меняет только руководство салона.',
  unauthorized: 'Сессия истекла — войдите снова.',
  bad_monday: 'Неделя начинается с понедельника.',
  date_too_old: 'Такой старой недели в графике нет.',
  date_too_far: 'Неделя слишком далеко в будущем.',
  bad_days: 'Не удалось прочитать дни недели.',
  // day_required / name_too_long — без подмены: сервер называет день
  shift_changed: 'График этой недели только что изменили в другом окне — нажмите «Обновить».',
  shift_duplicate: 'На эту неделю в базе две записи графика — исправьте в Strapi.',
  shift_not_found: 'Графика на эту неделю уже нет.',
}

const shiftsFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

/** Первая неделя окна по умолчанию: прошлая (видно, как было, — есть что копировать). */
export const defaultWindowStart = (today: string): string => addDaysYmd(mondayOfYmd(today), -7)

/**
 * Окно недель + ОДНА неделя перед ним (`before`) — источник для «как прошлая неделя»
 * у первой видимой недели; на экран она не выводится.
 */
export const fetchShiftWindow = async (
  start: string,
  weeks = WINDOW_WEEKS,
): Promise<ShiftWindow & { before: ShiftWeek | null }> => {
  const q = new URLSearchParams({ from: addDaysYmd(start, -7), weeks: String(weeks + 1) }).toString()
  const res = await shiftsFetch<{ weeks: ShiftWeek[]; names: string[] }>('GET', `/shifts?${q}`)
  const all = Array.isArray(res?.weeks) ? res.weeks : []
  return {
    before: all[0] ?? null,
    weeks: all.slice(1),
    names: Array.isArray(res?.names) ? res.names : [],
  }
}

export const saveShiftWeek = (monday: string, days: WeekDays, base: string | null) =>
  shiftsFetch<{ week: ShiftWeek; unchanged: boolean }>('PUT', `/shifts/${encodeURIComponent(monday)}`, {
    days,
    base,
  })

export const deleteShiftWeek = (monday: string, base: string | null) => {
  const q = base ? `?${new URLSearchParams({ base }).toString()}` : ''
  return shiftsFetch<{ deleted: string }>('DELETE', `/shifts/${encodeURIComponent(monday)}${q}`)
}

// ── логика формы (чистые функции) ──────────────────────────────────────────

export const EMPTY_DAYS: WeekDays = {
  monday: '',
  tuesday: '',
  wednesday: '',
  thursday: '',
  friday: '',
  saturday: '',
  sunday: '',
}

/** Как сервер: пробелы схлопнуты и обрезаны. */
export const cleanName = (v: string | null | undefined): string => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Правка отличается от сохранённого (у несохранённой недели — если что-то введено). */
export const isDirty = (saved: WeekDays | null, draft: WeekDays): boolean =>
  DAY_KEYS.some((k) => cleanName(saved?.[k]) !== cleanName(draft[k]))

/** Все 7 дней заполнены (обязательны по схеме). */
export const isComplete = (draft: WeekDays): boolean => DAY_KEYS.every((k) => cleanName(draft[k]) !== '')

/** Даты дней недели: monday → { monday: 'YYYY-MM-DD', … }. */
export const weekDates = (monday: string): Record<DayKey, string> =>
  Object.fromEntries(DAY_KEYS.map((k, i) => [k, addDaysYmd(monday, i)])) as Record<DayKey, string>

/** Новые имена после сохранения — в конец списка вариантов (без дублей). */
export const mergeNames = (names: string[], days: WeekDays | null): string[] => {
  const out = [...names]
  for (const k of DAY_KEYS) {
    const n = cleanName(days?.[k])
    if (n && !/^[-–—.]+$/.test(n) && !out.includes(n)) out.push(n)
  }
  return out
}
