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
export const DUAL_ROLE_WORKERS = ['Mariia Medvedeva', 'Oleksandra Fishchuk']

export interface CombinedResult {
  name: string
  countClient: number
  sum: number // заработок с клиентов (staffSalaries, как мастер)
  sumTip: number
  hours: number // отработанные часы (как администратор)
  rate: number // почасовая ставка администратора
  adminEarnings: number // hours * rate
  penalty: number
  extraProfit: number
  payrolls: number
  advance: number
  salaries: number
  taxes: number
  excessThreshold: number
}

export interface TeamSplit {
  masters: Result[] // только «чистые» мастера (без совместителей)
  admins: ResultAdmins[] // только «чистые» администраторы (без совместителей)
  combined: CombinedResult[] // совместители (мастер+администратор) одной строкой
  sumMasters: number // итог по чистым мастерам
  sumAdmins: number // итог по чистым администраторам
  sumCombined: number // итог по совместителям (полная зарплата)
  combinedAdminEarnings: number // только админ-часы совместителей (hours*rate) — для «Результат по услугам»
}

// Разделяет общие сводки мастеров и администраторов на три непересекающиеся группы.
// 🟢 ИНВАРИАНТ: sumMasters + sumAdmins + sumCombined === (старый sumMasters + sumAdmins).
// Это значит, что «Результат за месяц» и закрытие смены остаются численно прежними —
// мы лишь перегруппировали те же деньги, не потеряв и не задвоив ничего.
export function splitTeam(works: Result[], admins: ResultAdmins[]): TeamSplit {
  const dual = new Set(DUAL_ROLE_WORKERS)
  const masterByName = new Map(works.map((w) => [w.name, w]))
  const adminByName = new Map(admins.map((a) => [a.name, a]))

  const masters = works.filter((w) => !dual.has(w.name))
  const pureAdmins = admins.filter((a) => !dual.has(a.name))

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
      adminEarnings: (a?.sum ?? 0) * (a?.rate ?? 0),
      penalty: corr.penalty,
      extraProfit: corr.extraProfit,
      payrolls: corr.payrolls,
      advance: corr.advance,
      salaries: corr.salaries,
      taxes: corr.taxes,
      excessThreshold: w?.excessThreshold ?? a?.excessThreshold ?? 0,
    })
  }

  const sumMasters = masters.reduce(
    (s, m) => s + m.sum + m.sumTip + m.extraProfit - m.penalty - m.payrolls,
    0,
  )
  const sumAdmins = pureAdmins.reduce(
    (s, a) => s + a.sum * a.rate + a.extraProfit - a.penalty - a.payrolls,
    0,
  )
  const sumCombined = combined.reduce(
    (s, c) => s + c.sum + c.sumTip + c.adminEarnings + c.extraProfit - c.penalty - c.payrolls,
    0,
  )
  const combinedAdminEarnings = combined.reduce((s, c) => s + c.adminEarnings, 0)

  return {
    masters,
    admins: pureAdmins,
    combined: combined.sort((a, b) => b.sum + b.adminEarnings - (a.sum + a.adminEarnings)),
    sumMasters,
    sumAdmins,
    sumCombined,
    combinedAdminEarnings,
  }
}
