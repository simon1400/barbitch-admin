import { Axios } from '../../../../lib/api'

// ============================================================================
// Калькулятор отчислений за сотрудников по чешскому законодательству (2026).
// Вход: čistá mzda (сколько сотрудник получил на руки) → обратный расчёт hrubé
// → законные отчисления: zdravotní pojišťovna, ČSSZ (sociální), finanční úřad.
//
// Все константы года вынесены в TaxParams и редактируются в UI — при смене
// законов на новый год достаточно поправить числа (или DEFAULT_PARAMS ниже).
// ============================================================================

export interface TaxParams {
  minWage: number // minimální mzda = minimální vyměřovací základ zdravotního
  dppThreshold: number // rozhodná částka DPP: od této hrubé вступают odvody (≤ threshold−1 без odvodů)
  socialEmployee: number // доля сотрудника, sociální (0.071 = 6,5 % důchodové + 0,6 % nemocenské)
  socialEmployer: number // доля работодателя, sociální (0.248)
  healthEmployee: number // доля сотрудника, zdravotní (0.045)
  healthEmployer: number // доля работодателя, zdravotní (0.09)
  taxRate: number // záloha daně 15 %
  taxRateHigh: number // 23 % над hranicí
  taxHighFrom: number // месячная граница 23 % (36× průměrné mzdy / 12)
  slevaPoplatnik: number // sleva na poplatníka в месяц (при подписанном prohlášení)
  redukce1: number // redukční hranice hodinové для náhrady mzdy (nemoc)
  redukce2: number
  redukce3: number
  hoursPerDay: number // délka směny для пересчёта дней в часы
}

// Значения на 2026 год (проверены 08/2026):
// min. mzda 22 400; průměrná mzda 48 967 → DPP limit 12 000, 23 % od 146 901/мес;
// redukční hranice 285,78 / 428,58 / 856,98; sleva 2 570.
export const DEFAULT_PARAMS_2026: TaxParams = {
  minWage: 22_400,
  dppThreshold: 12_000,
  socialEmployee: 0.071,
  socialEmployer: 0.248,
  healthEmployee: 0.045,
  healthEmployer: 0.09,
  taxRate: 0.15,
  taxRateHigh: 0.23,
  taxHighFrom: 146_901,
  slevaPoplatnik: 2_570,
  redukce1: 285.78,
  redukce2: 428.58,
  redukce3: 856.98,
  hoursPerDay: 8,
}

// osvc = живностник на IČO: работает по фактуре, odvody и daň платит за себя сам,
// салон не отчисляет за него ничего (в расходы идёт только сумма фактуры).
export type ContractType = 'hpp' | 'dpp' | 'osvc'

export interface EmployeeTaxInput {
  contract: ContractType
  prohlaseni: boolean // подписано prohlášení k dani → sleva na poplatníka
  healthMinimum: boolean // применять doplatek do minimálního základu zdravotního
  dppAboveLimit?: boolean // форсировать трактовку «DPP над лимитом» (полные odvody)
  net: number // čistá, сколько получил на руки за месяц (вкл. náhradu за nemoc)
  sickDays: number // рабочие дни болезни (первые 14 календ. дней — náhrada mzdy)
  vacationPaidDays: number // оплачиваемый отпуск — эвиденция, на налоги не влияет
  unpaidDays: number // neplacené volno, рабочие дни
}

export interface EmployeeTaxResult {
  gross: number // hrubá mzda (без náhrady nemoci)
  sickCompensation: number // náhrada mzdy за nemoc — не облагается налогом и odvody
  netWork: number // фактически достигнутая čistá за работу (без náhrady)
  // Фактическая čistá целиком (netWork + náhrada). Из-за округлений «вверх» не
  // всякая čistá достижима целым hrubým — тогда берётся ближайшая и ставится
  // предупреждение. Инвариант odvodyTotal = totalCost − netActual держится
  // всегда, поэтому считать нужно от него, а не от введённого числа.
  netActual: number
  healthEmployee: number
  healthEmployer: number
  healthDoplatek: number // doplatek do minima (удерживается с сотрудника)
  healthTotal: number // всё, что уходит на zdravotní pojišťovnu
  socialEmployee: number
  socialEmployer: number
  socialTotal: number // всё, что уходит на ČSSZ
  tax: number // záloha / srážková daň → finanční úřad
  // Всё, что ушло в три института мимо кармана сотрудника. Инвариант:
  // odvodyTotal === totalCost − čistá (сколько заплачено сверх суммы «на руки»).
  employeeShare: number // удержано ИЗ зарплаты сотрудника (сидит внутри hrubé)
  employerShare: number // платит салон СВЕРХ hrubé
  odvodyTotal: number // employeeShare + employerShare
  taxWithheld: boolean // true = srážková daň (DPP без prohlášení под лимитом)
  odvodyApply: boolean // false = DPP под лимитом, без pojistného
  totalCost: number // полные затраты работодателя (hrubá + náhrada + odvody firmy)
  warnings: string[]
}

// Округление вверх до целых крон, устойчивое к float-мусору: 15000 × 0,071 в JS
// даёт 1065.0000000000002 → голый Math.ceil вернул бы 1066 Kč вместо законных
// 1065. Сначала гасим шум на уровне сотых, потом округляем вверх.
const ceilKc = (n: number): number => Math.ceil(Math.round(n * 100) / 100)

// --- Фонд рабочих дней месяца (Пн–Пт минус чешские госпраздники) ---

// Грегорианский компутус — дата пасхального воскресенья
const easterSunday = (year: number): Date => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const eMonth = Math.floor((h + l - 7 * m + 114) / 31)
  const eDay = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, eMonth - 1, eDay))
}

const DAY_MS = 86_400_000

const czechHolidays = (year: number): Set<string> => {
  const fixed = [
    '01-01', '05-01', '05-08', '07-05', '07-06', '09-28',
    '10-28', '11-17', '12-24', '12-25', '12-26',
  ]
  const set = new Set(fixed.map((md) => `${year}-${md}`))
  const easter = easterSunday(year)
  // Velký pátek (−2) + Velikonoční pondělí (+1)
  for (const offset of [-2, 1]) {
    set.add(new Date(easter.getTime() + offset * DAY_MS).toISOString().slice(0, 10))
  }
  return set
}

export const workingDaysInMonth = (month: number, year: number): number => {
  const holidays = czechHolidays(year)
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  let n = 0
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(Date.UTC(year, month, d))
    const dow = dt.getUTCDay()
    if (dow === 0 || dow === 6) continue
    if (holidays.has(dt.toISOString().slice(0, 10))) continue
    n++
  }
  return n
}

// --- Náhrada mzdy (nemoc, первые 14 дней): редукция часового заработка §192 ZP ---
// 90 % до 1-й границы, 60 % между 1-й и 2-й, 30 % между 2-й и 3-й, выше — не считается.
// Náhrada = 60 % редуцированного часового × часы болезни.
export const reduceHourly = (phv: number, p: TaxParams): number => {
  let r = Math.min(phv, p.redukce1) * 0.9
  if (phv > p.redukce1) r += (Math.min(phv, p.redukce2) - p.redukce1) * 0.6
  if (phv > p.redukce2) r += (Math.min(phv, p.redukce3) - p.redukce2) * 0.3
  return r
}

// --- Прямой расчёт: hrubá → отчисления + čistá ---

interface GrossBreakdown {
  socialEmp: number
  socialEr: number
  healthEmp: number
  healthEr: number
  doplatek: number
  tax: number
  withheld: boolean
  odvodyApply: boolean
  net: number
}

const computeFromGross = (
  gross: number,
  input: Pick<EmployeeTaxInput, 'contract' | 'prohlaseni' | 'healthMinimum'>,
  p: TaxParams,
): GrossBreakdown => {
  // OSVČ: салон платит только фактуру — ни pojistného, ни zálohy na daň
  if (input.contract === 'osvc') {
    return {
      socialEmp: 0,
      socialEr: 0,
      healthEmp: 0,
      healthEr: 0,
      doplatek: 0,
      tax: 0,
      withheld: false,
      odvodyApply: false,
      net: gross,
    }
  }

  const isDpp = input.contract === 'dpp'
  const odvodyApply = gross > 0 && (!isDpp || gross >= p.dppThreshold)

  let socialEmp = 0
  let socialEr = 0
  let healthEmp = 0
  let healthEr = 0
  let doplatek = 0

  if (odvodyApply) {
    socialEmp = ceilKc(gross * p.socialEmployee)
    socialEr = ceilKc(gross * p.socialEmployer)
    // Zdravotní: считается celkem (13,5 %), сотрудник платит 1/3, работодатель остальное
    const healthTotal = ceilKc(gross * (p.healthEmployee + p.healthEmployer))
    healthEmp = ceilKc(healthTotal / 3)
    healthEr = healthTotal - healthEmp
    // Doplatek do minimálního vyměřovacího základu (удерживается с сотрудника)
    if (input.healthMinimum && gross < p.minWage) {
      doplatek = ceilKc((p.minWage - gross) * (p.healthEmployee + p.healthEmployer))
    }
  }

  let tax = 0
  let withheld = false
  if (gross > 0) {
    if (isDpp && !input.prohlaseni && gross < p.dppThreshold) {
      // Srážková daň 15 % (без слевы), округление вниз
      withheld = true
      tax = Math.floor(Math.floor(gross) * p.taxRate)
    } else {
      // Záloha: основа округляется вверх на целые 100 Kč, сама záloha вверх на Kč
      const base = Math.ceil(gross / 100) * 100
      let z =
        base <= p.taxHighFrom
          ? base * p.taxRate
          : p.taxHighFrom * p.taxRate + (base - p.taxHighFrom) * p.taxRateHigh
      z = ceilKc(z)
      if (input.prohlaseni) z = Math.max(0, z - p.slevaPoplatnik)
      tax = z
    }
  }

  return {
    socialEmp,
    socialEr,
    healthEmp,
    healthEr,
    doplatek,
    tax,
    withheld,
    odvodyApply,
    net: gross - socialEmp - healthEmp - doplatek - tax,
  }
}

// --- Обратный расчёт: čistá → hrubá ---
// В целом net растёт с gross, но НЕ строго монотонно: основа daně округляется
// вверх до целых 100 Kč, поэтому на границе сотни záloha прыгает на +15 Kč и
// čistá проседает. Из-за этой «пилы» чистый бинарный поиск даёт валидный, но не
// минимальный gross (напр. 30 018 вместо 30 000). Поэтому: бинарный поиск даёт
// приближение, затем линейный досмотр окна выбирает МИНИМАЛЬНЫЙ gross с точным
// попаданием в čistou (при отсутствии точного — ближайший).
//
// ⚠️ У DPP на пороге odvodů net СКАЧЕТ ВНИЗ (появляются pojistné), поэтому DPP
// ищем в двух ветках отдельно: [0, limit−1] и [limit, MAX].
const MAX_GROSS = 5_000_000
const REFINE_WINDOW = 600

const searchGross = (
  targetNet: number,
  lo: number,
  hi: number,
  input: Pick<EmployeeTaxInput, 'contract' | 'prohlaseni' | 'healthMinimum'>,
  p: TaxParams,
): number => {
  let a = lo
  let b = hi
  while (a < b) {
    const mid = Math.floor((a + b) / 2)
    if (computeFromGross(mid, input, p).net >= targetNet) b = mid
    else a = mid + 1
  }

  // Округления «вверх» делают отображение gross→net не инъективным: одну и ту же
  // čistou дают несколько соседних hrubých (напр. 14 999 и 15 000). Из точных
  // совпадений выбираем самое «круглое» — реальные зарплаты обычно кратны
  // сотням, поэтому 15 000 правдоподобнее, чем 14 999.
  const roundness = (g: number): number => {
    if (g % 1000 === 0) return 4
    if (g % 500 === 0) return 3
    if (g % 100 === 0) return 2
    if (g % 10 === 0) return 1
    return 0
  }

  const from = Math.max(lo, a - REFINE_WINDOW)
  const to = Math.min(hi, a + REFINE_WINDOW)
  let best = a
  let bestDiff = Number.POSITIVE_INFINITY
  let bestRound = -1
  for (let g = from; g <= to; g++) {
    const diff = Math.abs(computeFromGross(g, input, p).net - targetNet)
    const r = roundness(g)
    if (diff < bestDiff || (diff === bestDiff && r > bestRound)) {
      bestDiff = diff
      bestRound = r
      best = g
    }
  }
  return best
}

type GrossInput = Pick<
  EmployeeTaxInput,
  'contract' | 'prohlaseni' | 'healthMinimum' | 'dppAboveLimit'
>

// true, если ту же čistou у DPP можно объяснить И суммой под лимитом (без
// pojistného), И суммой над лимитом. Тогда выбор ветки — за пользователем.
export const dppAmbiguous = (targetNet: number, input: GrossInput, p: TaxParams): boolean => {
  if (input.contract !== 'dpp' || targetNet <= 0) return false
  return targetNet <= computeFromGross(p.dppThreshold - 1, input, p).net
}

export const grossFromNet = (targetNet: number, input: GrossInput, p: TaxParams): number => {
  if (targetNet <= 0) return 0
  if (input.contract === 'osvc') return targetNet // фактура = ровно то, что заплатили
  if (input.contract === 'dpp') {
    // Под лимитом odvody не платятся, поэтому čistá ≈ hrubá — низкая čistá
    // объясняется обеими ветками. По умолчанию берём ветку «под лимитом»
    // (обычный случай бригадника); пользователь может форсировать другую.
    if (!input.dppAboveLimit && dppAmbiguous(targetNet, input, p)) {
      return searchGross(targetNet, 0, p.dppThreshold - 1, input, p)
    }
    return searchGross(targetNet, p.dppThreshold, MAX_GROSS, input, p)
  }
  return searchGross(targetNet, 0, MAX_GROSS, input, p)
}

// --- Полный расчёт по сотруднику ---
// Náhrada за nemoc не облагается ни налогом, ни pojistným → вычитается из čisté
// ДО обратного расчёта hrubé. Náhrada зависит от часового заработка, который
// оцениваем из hrubé этого же месяца → решаем итерацией (сходится за 2-3 шага).
export const computeEmployee = (
  input: EmployeeTaxInput,
  month: number,
  year: number,
  p: TaxParams,
): EmployeeTaxResult => {
  const warnings: string[] = []
  const fondDays = workingDaysInMonth(month, year)
  const paidWorkDays = Math.max(1, fondDays - input.sickDays - input.unpaidDays)

  let sickComp = 0
  let gross = 0
  let bd = computeFromGross(0, input, p)

  for (let iter = 0; iter < 8; iter++) {
    const netWork = Math.max(0, input.net - sickComp)
    gross = grossFromNet(netWork, input, p)
    bd = computeFromGross(gross, input, p)

    if (!input.sickDays) break
    // Náhrada положена только при účasti na nemocenském pojištění
    if (!bd.odvodyApply) {
      sickComp = 0
      break
    }
    // Часовой заработок: приводим hrubou к полному месяцу и делим на фонд часов.
    // Приближение — закон берёт средний за предыдущий квартал.
    const fullGross = gross * (fondDays / paidWorkDays)
    const phv = fullGross / (fondDays * p.hoursPerDay)
    const next = Math.round(reduceHourly(phv, p) * 0.6 * input.sickDays * p.hoursPerDay)
    if (Math.abs(next - sickComp) < 1) {
      sickComp = next
      break
    }
    sickComp = next
  }

  // Финальный пересчёт с устоявшейся náhradou
  const targetNetWork = Math.max(0, input.net - sickComp)
  gross = grossFromNet(targetNetWork, input, p)
  bd = computeFromGross(gross, input, p)

  // Достигнутая čistá (может отличаться от введённой на пару крон, если такая
  // сумма недостижима, либо сильно — если ветка DPP «nad limitem» её не даёт)
  const netWork = bd.net
  const netActual = netWork + sickComp
  if (input.net > 0 && netActual !== input.net) {
    warnings.push(
      `Přesně ${input.net.toLocaleString('cs-CZ')} Kč čistého nelze dosáhnout — počítáno z nejbližší ${netActual.toLocaleString('cs-CZ')} Kč`,
    )
  }

  if (input.contract === 'dpp' && gross >= p.dppThreshold) {
    warnings.push(`DPP nad limit ${p.dppThreshold.toLocaleString('cs-CZ')} Kč → полные odvody`)
  }
  if (input.contract === 'dpp' && !input.dppAboveLimit && dppAmbiguous(targetNetWork, input, p)) {
    warnings.push('Ту же čistou даёт и вариант «nad limitem» — включи галку, если это он')
  }
  if (input.contract === 'dpp' && !bd.odvodyApply && input.sickDays > 0) {
    warnings.push('DPP под лимитом: náhrada за nemoc не положена (нет nemocenského pojištění)')
  }
  if (input.contract === 'osvc') {
    warnings.push('OSVČ: odvody a daň si platí sám — salon hradí jen fakturu')
  }
  if (bd.doplatek > 0) {
    warnings.push('Hrubá ниже минималки → doplatek zdravotního (удержан с сотрудника)')
  }
  if (input.sickDays + input.unpaidDays + input.vacationPaidDays > fondDays) {
    warnings.push('Дней отсутствия больше, чем рабочих дней в месяце')
  }

  const employeeShare = bd.healthEmp + bd.doplatek + bd.socialEmp + bd.tax
  const employerShare = bd.healthEr + bd.socialEr

  return {
    gross,
    sickCompensation: sickComp,
    netWork,
    netActual,
    healthEmployee: bd.healthEmp,
    healthEmployer: bd.healthEr,
    healthDoplatek: bd.doplatek,
    healthTotal: bd.healthEmp + bd.healthEr + bd.doplatek,
    socialEmployee: bd.socialEmp,
    socialEmployer: bd.socialEr,
    socialTotal: bd.socialEmp + bd.socialEr,
    tax: bd.tax,
    employeeShare,
    employerShare,
    odvodyTotal: employeeShare + employerShare,
    taxWithheld: bd.withheld,
    odvodyApply: bd.odvodyApply,
    totalCost: gross + sickComp + bd.socialEr + bd.healthEr,
    warnings,
  }
}

// --- Список сотрудников для предзаполнения строк ---

export interface PersonalOption {
  documentId: string
  name: string
  typeWork: string | null // hpp | dpp | null — из последней ставки personal.rates
}

interface RawPersonal {
  documentId: string
  name: string
  rates?: Array<{ typeWork?: string | null; from?: string | null }> | null
}

export const fetchPersonals = async (): Promise<PersonalOption[]> => {
  const data: RawPersonal[] = await Axios.get(
    '/api/personals?filters[isActive][$eq]=true&fields[0]=name' +
      '&populate[rates][fields][0]=typeWork&populate[rates][fields][1]=from' +
      '&pagination[pageSize]=100&sort=name:asc&status=published',
  )

  return (data || []).map((item) => {
    const rates = item.rates || []
    // Последняя по дате начала ставка — актуальный тип договора
    const latest = [...rates].sort((a, b) => (a.from || '').localeCompare(b.from || '')).at(-1)
    return {
      documentId: item.documentId,
      name: item.name,
      typeWork: latest?.typeWork || null,
    }
  })
}
