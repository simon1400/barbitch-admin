import { Axios } from '../../../lib/api'

// Зарплатные группы из карточек сотрудников (s229, план «Карточка сотрудника» §5а.2).
//
// Раньше это были списки в коде (teamSplit.ts: DUAL_ROLE_WORKERS / MANAGERS) по ИМЕНИ:
// переименование карточки молча выкидывало человека из группы, а совпадение имени
// втягивало чужого. Так и случилось: карточку ушедшей Oleksandra Fishchuk переименовали
// в «❌ Oleksandra Fishchuk», список остался со старым именем — и в её месяцах
// совмещения (01–03.2026) корректировки считались дважды (строка мастера И строка
// администратора).
//
// Теперь группа — поля карточки: `dualRole` ('yes') + `dualRoleUntil` ('YYYY-MM',
// последний месяц совмещения, пусто — бессрочно), `managerSince` ('YYYY-MM', первый
// месяц управляющей). Правятся в карточке сотрудника (секция «Оплата»).
//
// Имя в группе — ТЕКУЩЕЕ имя карточки из той же базы, что и строки месяца (их имя
// тоже приходит связью `personal`), поэтому сводки по-прежнему сшиваются по имени,
// но переименование их больше не рвёт.
//
// 🟥 Ошибка загрузки НЕ глотается: месяц, посчитанный «без групп», лёг бы в вечный
// кэш прошлых месяцев с задвоенными корректировками. Пусть лучше расчёт упадёт.

export interface DualRoleGroup {
  docId: string
  name: string
  /** последний месяц совмещения 'YYYY-MM' включительно; нет — бессрочно */
  until?: string
}
export interface ManagerGroup {
  docId: string
  name: string
  /** первый месяц в роли 'YYYY-MM' */
  since: string
}
export interface PayrollGroups {
  dual: DualRoleGroup[]
  managers: ManagerGroup[]
}

interface RawCard {
  documentId: string
  name: string | null
  dualRole?: string | null
  dualRoleUntil?: string | null
  managerSince?: string | null
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/

// опубликованные версии — как у всех выборок месяца (REST по умолчанию)
const QUERY =
  '/api/personals?fields[0]=name&fields[1]=dualRole&fields[2]=dualRoleUntil&fields[3]=managerSince' +
  '&pagination[pageSize]=200&status=published'

/** Карточки → группы (порядок — по имени, чтобы результат не зависел от порядка ответа). */
export const groupsFromCards = (rows: RawCard[]): PayrollGroups => {
  const dual: DualRoleGroup[] = []
  const managers: ManagerGroup[] = []
  for (const r of rows || []) {
    if (!r?.documentId || !r.name) continue
    if (r.dualRole === 'yes') {
      const until = YM.test(String(r.dualRoleUntil ?? '')) ? (r.dualRoleUntil as string) : undefined
      dual.push(until ? { docId: r.documentId, name: r.name, until } : { docId: r.documentId, name: r.name })
    }
    if (YM.test(String(r.managerSince ?? ''))) {
      managers.push({ docId: r.documentId, name: r.name, since: r.managerSince as string })
    }
  }
  const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  return { dual: dual.sort(byName), managers: managers.sort(byName) }
}

// Один запрос на всю страницу: месяц, закрытие смены и оклад управляющей зовут загрузчик
// параллельно. Срок — 5 минут; правка группы в карточке сбрасывает сразу.
const TTL_MS = 5 * 60 * 1000
let cached: { at: number; value: PayrollGroups } | null = null
let inflight: Promise<PayrollGroups> | null = null

export const fetchPayrollGroups = (): Promise<PayrollGroups> => {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.value)
  if (inflight) return inflight
  const p = (Axios.get(QUERY) as Promise<RawCard[]>)
    .then((rows) => {
      const value = groupsFromCards(rows)
      if (inflight === p) cached = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      if (inflight === p) inflight = null
    })
  inflight = p
  return p
}

export const invalidatePayrollGroups = () => {
  cached = null
  inflight = null
}
