import type { ResultAdmins } from './allAdminsHours'
import type { Result } from './allWorks'

// Сотрудники, которые работают И мастером, И администратором. Их данные собираются
// в отдельную таблицу «Совместители» (см. Combined.tsx) — там в одной строке считается
// всё: часы как администратор + заработок с клиентов + чай + штрафы/списывания/налоги.
// Их корректировки берутся ОДИН раз (они приходят из общих коллекций penalties/payrolls/…
// по имени, без привязки к роли), поэтому двойного учёта нет.
//
// ⚠️ Раньше это кодировалось тремя разрозненными списками-исключениями
// (ADMIN_MASTERS в Masters.tsx, excludeFromMasters в allWorks.ts, excludeFromAdmins
// в allAdminsHours.ts). Теперь это ОДИН источник истины. Новый совместитель → добавить сюда.
//
// `until` — последний месяц совмещения ('YYYY-MM', включительно). Роли в базе дат не
// хранят, поэтому граница живёт здесь: снять человека из списка целиком нельзя —
// в прошлых месяцах, где у него есть и часы, и услуги, он попал бы в обе таблицы,
// и штрафы/списывания вычлись бы дважды (итог месяца задним числом изменился бы).
// После `until` сотрудник — обычный мастер/админ; итог месяца от этого не меняется,
// пока у него нет часов во второй роли.
const DUAL_ROLE_WORKERS: { name: string; until?: string }[] = [
  // С 07.2026 только мастер (последние часы администратора — июнь 2026).
  { name: 'Mariia Medvedeva', until: '2026-06' },
  { name: 'Oleksandra Fishchuk' },
]

// Управляющие (s213) — фиксированный оклад в месяц + обычные корректировки.
// `since` — первый месяц в роли ('YYYY-MM'). Тот же принцип, что у совместителей:
// роль в базе дат не хранит, а прошлые месяцы меняться не должны — до `since`
// человек считается там, где считался (сентябрь 2026 Mariia — мастер с услугами).
// Оклад — запись `rates` типа HPP с `from` НЕ РАНЬШЕ `since` (см. managerMonthlyFixed).
const MANAGERS: { name: string; since: string }[] = [{ name: 'Mariia Medvedeva', since: '2026-10' }]

/** Управляющие, чья роль действует в периоде, начинающемся с periodStart ('YYYY-MM'). */
export const managersFor = (periodStart: string): { name: string; since: string }[] =>
  MANAGERS.filter((m) => m.since <= periodStart)

export const managerNamesFor = (periodStart: string): Set<string> =>
  new Set(managersFor(periodStart).map((m) => m.name))

// periodStart — первый месяц периода ('YYYY-MM'). Период, задевающий хотя бы один
// месяц совмещения, считается совместительским: там могут быть часы во второй роли.
// Управляющий периода в совместители не попадает — его строка своя.
export const dualRoleNames = (periodStart: string): Set<string> => {
  const managers = managerNamesFor(periodStart)
  return new Set(
    DUAL_ROLE_WORKERS.filter((w) => (!w.until || periodStart <= w.until) && !managers.has(w.name)).map(
      (w) => w.name,
    ),
  )
}

export interface ManagerRateItem {
  rate: number | string | null
  from?: string | null
  to?: string | null
  typeWork?: string | null
}

// Оклад управляющей на дату (YYYY-MM-DD). 🟥 Берётся ТОЛЬКО запись HPP, начавшаяся
// не раньше первого дня роли: у Mariia есть старая HPP-запись rate=150 (часовая ставка
// администратора с 08.2025) — без этого условия она прочиталась бы как «оклад 150 Kč».
// Нет подходящей записи → null (строка покажет «оклад не задан», в деньгах 0).
export const managerMonthlyFixed = (
  rates: ManagerRateItem[] | null | undefined,
  since: string,
  dateStr: string,
): number | null => {
  const d = dateStr.slice(0, 10)
  const sinceDay = `${since}-01`
  let found: ManagerRateItem | null = null
  let foundFrom = ''
  for (const r of rates || []) {
    if (r.typeWork !== 'hpp') continue
    const from = (r.from || '').slice(0, 10)
    const to = r.to ? r.to.slice(0, 10) : '9999-12-31'
    if (from < sinceDay || from > d || d > to) continue
    if (from >= foundFrom) {
      found = r
      foundFrom = from
    }
  }
  if (!found) return null
  const n = Number(found.rate)
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface CombinedResult {
  name: string
  countClient: number
  sum: number // заработок с клиентов (staffSalaries, как мастер)
  sumTip: number
  hours: number // отработанные часы (как администратор)
  rate: number // почасовая ставка администратора (на конец периода, информационно)
  adminEarnings: number // заработок за часы (по-сменный расчёт — ставка может меняться посреди месяца)
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
  excessThreshold: number
}

export interface ManagerResult {
  name: string
  fixed: number // оклад за период (0, если не задан)
  fixedMissing: boolean // нет записи оклада с from ≥ since — показать предупреждение
  countClient: number // услуги как мастер (в порядке исключения) — обычно 0
  sum: number
  sumTip: number
  adminEarnings: number // часы администратора, если вдруг есть
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
}

/** Результат строки управляющей = оклад + доли + чай + часы + доп − штрафы − списывания. */
export const managerRowResult = (m: ManagerResult): number =>
  m.fixed + m.sum + m.sumTip + m.adminEarnings + m.extraProfit - m.penalty - m.payrolls

export interface TeamSplit {
  masters: Result[] // только «чистые» мастера (без совместителей и управляющих)
  admins: ResultAdmins[] // только «чистые» администраторы (без совместителей и управляющих)
  combined: CombinedResult[] // совместители (мастер+администратор) одной строкой
  managers: ManagerResult[] // управляющие — строка есть всегда, даже без активности
  sumMasters: number // итог по чистым мастерам
  sumAdmins: number // итог по чистым администраторам
  sumCombined: number // итог по совместителям (полная зарплата)
  sumManagers: number // итог по управляющим (оклад + корректировки)
  combinedAdminEarnings: number // только админ-часы совместителей (hours*rate) — для «Результат по услугам»
}

// Разделяет общие сводки мастеров и администраторов на четыре непересекающиеся группы.
// 🟢 ИНВАРИАНТ: sumMasters + sumAdmins + sumCombined + (sumManagers − оклады) ===
// (старый sumMasters + sumAdmins). Деньги перегруппированы без потерь и задвоений;
// сверх них добавляется только оклад управляющих. До `since` managers пуст и итог
// месяца численно прежний.
//
// managerFixed — оклад по имени за период (уже рассчитанный: целый месяц или доля
// недели); нет имени в карте → оклад не задан.
// ⚠️ Корректировки управляющей приходят из строки мастеров: getAllWorks заводит её
// строку заранее (seed), иначе штрафы/списывания без услуг молча пропали бы.
export function splitTeam(
  works: Result[],
  admins: ResultAdmins[],
  periodStart: string,
  managerFixed: Map<string, number | null> = new Map(),
): TeamSplit {
  const managerNames = managerNamesFor(periodStart)
  const dual = dualRoleNames(periodStart)
  const masterByName = new Map(works.map((w) => [w.name, w]))
  const adminByName = new Map(admins.map((a) => [a.name, a]))

  const masters = works.filter((w) => !dual.has(w.name) && !managerNames.has(w.name))
  const pureAdmins = admins.filter((a) => !dual.has(a.name) && !managerNames.has(a.name))

  const combined: CombinedResult[] = []
  for (const name of dual) {
    const w = masterByName.get(name)
    const a = adminByName.get(name)
    // Сотрудник без активности в этом месяце (нет ни услуг, ни часов) — пропускаем.
    if (!w && !a) continue

    // Корректировки одинаковы в обеих сводках (один источник по имени) → берём из любой.
    const corr = w ?? a!

    combined.push({
      name,
      countClient: w?.countClient ?? 0,
      sum: w?.sum ?? 0,
      sumTip: w?.sumTip ?? 0,
      hours: a?.sum ?? 0,
      rate: a?.rate ?? 0,
      adminEarnings: a?.earned ?? 0,
      penalty: corr.penalty,
      extraProfit: corr.extraProfit,
      payrolls: corr.payrolls,
      advance: corr.advance,
      salaries: corr.salaries,
      taxes: corr.taxes,
      excessThreshold: w?.excessThreshold ?? a?.excessThreshold ?? 0,
    })
  }

  const managers: ManagerResult[] = []
  for (const name of managerNames) {
    const w = masterByName.get(name)
    const a = adminByName.get(name)
    // Корректировки одинаковы в обеих сводках (один источник по имени) → из любой.
    const corr = w ?? a
    const fixed = managerFixed.get(name) ?? null
    managers.push({
      name,
      fixed: fixed ?? 0,
      fixedMissing: fixed == null,
      countClient: w?.countClient ?? 0,
      sum: w?.sum ?? 0,
      sumTip: w?.sumTip ?? 0,
      adminEarnings: a?.earned ?? 0,
      penalty: corr?.penalty ?? 0,
      extraProfit: corr?.extraProfit ?? 0,
      payrolls: corr?.payrolls ?? 0,
      advance: corr?.advance ?? 0,
      salaries: corr?.salaries ?? 0,
      taxes: corr?.taxes ?? 0,
    })
  }

  const sumMasters = masters.reduce(
    (s, m) => s + m.sum + m.sumTip + m.extraProfit - m.penalty - m.payrolls,
    0,
  )
  const sumAdmins = pureAdmins.reduce(
    (s, a) => s + a.earned + a.extraProfit - a.penalty - a.payrolls,
    0,
  )
  const sumCombined = combined.reduce(
    (s, c) => s + c.sum + c.sumTip + c.adminEarnings + c.extraProfit - c.penalty - c.payrolls,
    0,
  )
  const sumManagers = managers.reduce((s, m) => s + managerRowResult(m), 0)
  const combinedAdminEarnings = combined.reduce((s, c) => s + c.adminEarnings, 0)

  return {
    masters,
    admins: pureAdmins,
    combined: combined.sort((a, b) => b.sum + b.adminEarnings - (a.sum + a.adminEarnings)),
    managers,
    sumMasters,
    sumAdmins,
    sumCombined,
    sumManagers,
    combinedAdminEarnings,
  }
}
