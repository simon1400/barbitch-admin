import { useState, useEffect, useCallback, useMemo } from 'react'
import { Select } from '../../../dashboard/components/Select'
import { StatSection } from '../../components/StatSection'
import {
  DEFAULT_PARAMS_2026,
  computeEmployee,
  workingDaysInMonth,
  fetchPersonals,
  type TaxParams,
  type ContractType,
  type EmployeeTaxResult,
  type PersonalOption,
} from '../fetch/czechTax'
import { fetchTimeOffs, buildSummaries, daysInMonth } from '../fetch/timeOff'

// Одна карточка = один сотрудник за месяц. Живёт только в state —
// калькулятор, ничего не сохраняется (решение владельца).
interface Row {
  id: string
  name: string
  contract: ContractType
  prohlaseni: boolean
  healthMinimum: boolean
  dppAboveLimit: boolean
  net: string
  sickDays: string
  vacationPaidDays: string
  vacationUnpaidDays: string
}

const newRow = (name = ''): Row => ({
  id: crypto.randomUUID(),
  name,
  contract: 'hpp',
  prohlaseni: true,
  healthMinimum: true,
  dppAboveLimit: false,
  net: '',
  sickDays: '0',
  vacationPaidDays: '0',
  vacationUnpaidDays: '0',
})

const num = (s: string): number => {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const kc = (n: number): string => `${Math.round(n).toLocaleString('cs-CZ')} Kč`

const inputCls =
  'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none'
// ⚠️ Кастомная шкала admin: text-base = 26px/45px, text-xl = 71px. Для сумм и
// подписей берём literal-размеры, чтобы ячейки не раздувались.
const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-tight mb-1'

const CONTRACT_LABEL: Record<ContractType, string> = {
  hpp: 'HPP',
  dpp: 'DPP',
  osvc: 'OSVČ',
}

export default function TaxesTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<Row[]>([newRow()])
  const [params, setParams] = useState<TaxParams>(DEFAULT_PARAMS_2026)
  const [people, setPeople] = useState<PersonalOption[]>([])
  const [loadingTimeOff, setLoadingTimeOff] = useState(false)

  // Фактически уплаченные суммы (из выписок) — для сверки с расчётом
  const [paidHealth, setPaidHealth] = useState('')
  const [paidSocial, setPaidSocial] = useState('')
  const [paidTax, setPaidTax] = useState('')

  useEffect(() => {
    fetchPersonals()
      .then(setPeople)
      .catch(() => setPeople([]))
  }, [])

  const patch = useCallback((id: string, p: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)))
  }, [])

  // Подставить сотрудников и их дни отсутствия из таба «Больничные / отпуска»
  const prefill = useCallback(async () => {
    setLoadingTimeOff(true)
    try {
      const recs = await fetchTimeOffs(month, year)
      const summaries = buildSummaries(recs, month, year)
      const byName = new Map(summaries.map((s) => [s.name, s]))

      setRows((prev) => {
        const base = prev.some((r) => r.name || r.net)
          ? prev
          : people.map((p) => ({
              ...newRow(p.name),
              contract: (p.typeWork === 'dpp' ? 'dpp' : 'hpp') as ContractType,
            }))

        return base.map((r) => {
          const s = byName.get(r.name)
          if (!s) return r
          // sick → больничные; vacation/personal делим по признаку paid
          let paidV = 0
          let unpaidV = 0
          for (const rec of s.records) {
            if (rec.type === 'sick') continue
            const d = daysInMonth(rec, month, year)
            if (rec.paid) paidV += d
            else unpaidV += d
          }
          return {
            ...r,
            sickDays: String(s.sick),
            vacationPaidDays: String(paidV),
            vacationUnpaidDays: String(unpaidV),
          }
        })
      })
    } finally {
      setLoadingTimeOff(false)
    }
  }, [month, year, people])

  const fondDays = workingDaysInMonth(month, year)

  const results = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        res: computeEmployee(
          {
            contract: r.contract,
            prohlaseni: r.prohlaseni,
            healthMinimum: r.healthMinimum,
            dppAboveLimit: r.dppAboveLimit,
            net: num(r.net),
            sickDays: num(r.sickDays),
            vacationPaidDays: num(r.vacationPaidDays),
            unpaidDays: num(r.vacationUnpaidDays),
          },
          month,
          year,
          params,
        ) as EmployeeTaxResult,
      })),
    [rows, month, year, params],
  )

  const totals = results.reduce(
    (a, { res }) => ({
      gross: a.gross + res.gross,
      health: a.health + res.healthTotal,
      social: a.social + res.socialTotal,
      tax: a.tax + res.tax,
      cost: a.cost + res.totalCost,
      odvodyTotal: a.odvodyTotal + res.odvodyTotal,
      employerShare: a.employerShare + res.employerShare,
      employeeShare: a.employeeShare + res.employeeShare,
    }),
    {
      gross: 0,
      health: 0,
      social: 0,
      tax: 0,
      cost: 0,
      odvodyTotal: 0,
      employerShare: 0,
      employeeShare: 0,
    },
  )

  const checks = [
    { key: 'h', label: 'Zdravotní pojišťovna', calc: totals.health, paid: paidHealth, set: setPaidHealth, tone: 'text-blue-700' },
    { key: 's', label: 'Sociální (ČSSZ)', calc: totals.social, paid: paidSocial, set: setPaidSocial, tone: 'text-amber-700' },
    { key: 't', label: 'Finanční úřad (daň)', calc: totals.tax, paid: paidTax, set: setPaidTax, tone: 'text-red-700' },
  ]

  return (
    <>
      {/* один общий список имён для автокомплита во всех карточках */}
      <datalist id="tax-personals">
        {people.map((p) => (
          <option key={p.documentId} value={p.name} />
        ))}
      </datalist>

      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <span className="text-xs text-gray-400">
          Pracovních dnů v měsíci: <b>{fondDays}</b> · данные нигде не сохраняются
        </span>
      </div>

      <StatSection title="Сотрудники за месяц" id="tax-employees" defaultOpen>
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setRows((p) => [...p, newRow()])}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90"
          >
            + Сотрудник
          </button>
          <button
            onClick={prefill}
            disabled={loadingTimeOff}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingTimeOff ? 'Načítám…' : 'Подставить команду + дни отсутствия'}
          </button>
          <button
            onClick={() => setRows([newRow()])}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 hover:bg-gray-50"
          >
            Очистить
          </button>
        </div>

        <div className="space-y-4">
          {results.map(({ row, res }) => (
            <EmployeeCard
              key={row.id}
              row={row}
              res={res}
              people={people}
              onPatch={(p) => patch(row.id, p)}
              onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
            />
          ))}
        </div>

        {/* Итог по всем сотрудникам — те же ячейки, что в карточке */}
        <div className="mt-6 rounded-xl border-2 border-gray-300 bg-gray-50 p-4">
          <div className="mb-3 text-sm font-bold text-gray-700">
            Итого за месяц · {results.filter((r) => r.res.gross > 0).length} сотр.
          </div>
          <ResultGrid
            gross={totals.gross}
            health={totals.health}
            social={totals.social}
            tax={totals.tax}
            cost={totals.cost}
            big
          />
          <OdvodyBox res={totals} totalLabel="Odvody celkem za všechny zaměstnance" />
        </div>
      </StatSection>

      <StatSection title="Сверка с фактическими платежами" id="tax-reconcile" defaultOpen>
        <p className="text-sm text-gray-500 mb-4">
          Введи, сколько реально ушло со счёта за месяц. Разница показывает расхождение расчёта по
          закону с тем, что заплатила бухгалтерия (переплата / недоплата / другой месяц).
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => {
            const paid = num(c.paid)
            const diff = paid - c.calc
            const has = paid > 0
            return (
              <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className={`text-sm font-bold mb-3 ${c.tone}`}>{c.label}</div>

                <div className="flex items-baseline justify-between mb-3">
                  <span className={labelCls + ' mb-0'}>По расчёту</span>
                  <span className="text-[15px] font-bold text-blue-gray-900">{kc(c.calc)}</span>
                </div>

                <label className="block mb-3">
                  <span className={labelCls}>Заплачено фактически</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.paid}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </label>

                <div
                  className={`rounded-lg px-3 py-2 text-sm font-bold text-center ${
                    !has
                      ? 'bg-gray-50 text-gray-400'
                      : diff === 0
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                  }`}
                >
                  {!has
                    ? 'zadej částku'
                    : diff === 0
                      ? '✓ sedí přesně'
                      : `rozdíl ${diff > 0 ? '+' : ''}${kc(diff)}`}
                </div>
              </div>
            )
          })}
        </div>
      </StatSection>

      <StatSection title="Параметры года (2026)" id="tax-params">
        <p className="text-sm text-gray-500 mb-4">
          Значения по состоянию на 2026 год. При смене законов поправь здесь — расчёт пересчитается
          сразу.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ParamInput
            label="Minimální mzda"
            value={params.minWage}
            onChange={(v) => setParams({ ...params, minWage: v })}
          />
          <ParamInput
            label="Limit DPP (rozhodná částka)"
            value={params.dppThreshold}
            onChange={(v) => setParams({ ...params, dppThreshold: v })}
          />
          <ParamInput
            label="Sleva na poplatníka"
            value={params.slevaPoplatnik}
            onChange={(v) => setParams({ ...params, slevaPoplatnik: v })}
          />
          <ParamInput
            label="Hranice 23 % daně (měsíčně)"
            value={params.taxHighFrom}
            onChange={(v) => setParams({ ...params, taxHighFrom: v })}
          />
          <ParamInput
            label="Sociální — zaměstnanec %"
            value={params.socialEmployee * 100}
            step={0.1}
            onChange={(v) => setParams({ ...params, socialEmployee: v / 100 })}
          />
          <ParamInput
            label="Sociální — firma %"
            value={params.socialEmployer * 100}
            step={0.1}
            onChange={(v) => setParams({ ...params, socialEmployer: v / 100 })}
          />
          <ParamInput
            label="Zdravotní — zaměstnanec %"
            value={params.healthEmployee * 100}
            step={0.1}
            onChange={(v) => setParams({ ...params, healthEmployee: v / 100 })}
          />
          <ParamInput
            label="Zdravotní — firma %"
            value={params.healthEmployer * 100}
            step={0.1}
            onChange={(v) => setParams({ ...params, healthEmployer: v / 100 })}
          />
          <ParamInput
            label="Délka směny (hod)"
            value={params.hoursPerDay}
            step={0.5}
            onChange={(v) => setParams({ ...params, hoursPerDay: v })}
          />
        </div>
      </StatSection>
    </>
  )
}

// Ячейка результата: подпись сверху, сумма снизу. Сетка из таких ячеек
// заменяет широкие колонки таблицы — на телефоне складывается в 2 колонки.
function StatBox({
  label,
  value,
  tone = 'text-blue-gray-900',
  big,
}: {
  label: string
  value: string
  tone?: string
  big?: boolean
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className={labelCls + ' mb-0.5'}>{label}</div>
      <div className={`${big ? 'text-[19px]' : 'text-[15px]'} font-bold leading-snug ${tone}`}>
        {value}
      </div>
    </div>
  )
}

// Главный ответ на вопрос «сколько я заплатил за человека сверх того, что он
// получил на руки». Инвариант: odvodyTotal = náklad firmy − čistá.
// ⚠️ primary с alpha (bg-primary/5) в этом проекте не рендерится — только hex.
function OdvodyBox({
  res,
  totalLabel = 'Odvody celkem — mimo čistou mzdu',
}: {
  res: Pick<EmployeeTaxResult, 'odvodyTotal' | 'employerShare' | 'employeeShare'>
  totalLabel?: string
}) {
  if (!res.odvodyTotal) return null

  return (
    <div className="mt-3 rounded-lg border border-[#e71e6e40] bg-[#e71e6e0d] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className={labelCls + ' mb-0'}>{totalLabel}</span>
        <span className="text-[19px] font-bold text-primary leading-none">
          {kc(res.odvodyTotal)}
        </span>
      </div>
      <div className="mt-1.5 text-xs text-gray-600">
        z toho platí salon navíc <b>{kc(res.employerShare)}</b> · sráženo ze mzdy zaměstnance{' '}
        <b>{kc(res.employeeShare)}</b>
      </div>
    </div>
  )
}

function ResultGrid({
  gross,
  health,
  social,
  tax,
  cost,
  big,
}: {
  gross: number
  health: number
  social: number
  tax: number
  cost: number
  big?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      <StatBox label="Hrubá mzda" value={gross ? kc(gross) : '—'} big={big} />
      <StatBox
        label="Zdravotní"
        value={health ? kc(health) : '—'}
        tone="text-blue-700"
        big={big}
      />
      <StatBox
        label="Sociální"
        value={social ? kc(social) : '—'}
        tone="text-amber-700"
        big={big}
      />
      <StatBox label="Daň (FÚ)" value={tax ? kc(tax) : '—'} tone="text-red-700" big={big} />
      <StatBox
        label="Náklad firmy"
        value={cost ? kc(cost) : '—'}
        tone="text-primary"
        big={big}
      />
    </div>
  )
}

function ParamInput({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={inputCls}
      />
    </label>
  )
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

function EmployeeCard({
  row,
  res,
  people,
  onPatch,
  onRemove,
}: {
  row: Row
  res: EmployeeTaxResult
  people: PersonalOption[]
  onPatch: (p: Partial<Row>) => void
  onRemove: () => void
}) {
  const isOsvc = row.contract === 'osvc'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Шапка: имя + тип смлувы + удалить */}
      <div className="flex items-end gap-3 flex-wrap mb-3">
        <label className="block flex-1 min-w-[180px]">
          <span className={labelCls}>Сотрудник</span>
          <input
            list="tax-personals"
            value={row.name}
            onChange={(e) => {
              const name = e.target.value
              const p = people.find((x) => x.name === name)
              onPatch(p ? { name, contract: p.typeWork === 'dpp' ? 'dpp' : 'hpp' } : { name })
            }}
            placeholder="Jméno"
            className={inputCls}
          />
        </label>

        <label className="block w-28">
          <span className={labelCls}>Смлува</span>
          <select
            value={row.contract}
            onChange={(e) => onPatch({ contract: e.target.value as ContractType })}
            className={inputCls}
          >
            {(['hpp', 'dpp', 'osvc'] as ContractType[]).map((c) => (
              <option key={c} value={c}>
                {CONTRACT_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={onRemove}
          className="h-[38px] px-3 rounded-lg border border-gray-300 text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Smazat zaměstnance"
        >
          ✕
        </button>
      </div>

      {/* Ввод: čistá + дни отсутствия */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumField
          label={isOsvc ? 'Fakturováno' : 'Čistá (na ruku)'}
          value={row.net}
          onChange={(net) => onPatch({ net })}
          placeholder="0"
          suffix="Kč"
        />
        <NumField
          label="Nemoc"
          value={row.sickDays}
          onChange={(sickDays) => onPatch({ sickDays })}
          suffix="dní"
        />
        <NumField
          label="Dovolená pl."
          value={row.vacationPaidDays}
          onChange={(vacationPaidDays) => onPatch({ vacationPaidDays })}
          suffix="dní"
        />
        <NumField
          label="Neplac. volno"
          value={row.vacationUnpaidDays}
          onChange={(vacationUnpaidDays) => onPatch({ vacationUnpaidDays })}
          suffix="dní"
        />
      </div>

      {/* Галки-модификаторы расчёта */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {isOsvc ? (
          <span className="text-xs text-gray-400">faktura — salon neodvádí nic</span>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={row.prohlaseni}
                onChange={(e) => onPatch({ prohlaseni: e.target.checked })}
                className="accent-primary"
              />
              podepsané prohlášení (sleva)
            </label>
            {row.contract === 'hpp' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={row.healthMinimum}
                  onChange={(e) => onPatch({ healthMinimum: e.target.checked })}
                  className="accent-primary"
                />
                doplatek ZP do minima
              </label>
            )}
            {row.contract === 'dpp' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={row.dppAboveLimit}
                  onChange={(e) => onPatch({ dppAboveLimit: e.target.checked })}
                  className="accent-primary"
                />
                nad limitem (s odvody)
              </label>
            )}
          </>
        )}
      </div>

      <div className="my-3 border-t border-gray-100" />

      {/* Результат расчёта */}
      <ResultGrid
        gross={res.gross}
        health={res.healthTotal}
        social={res.socialTotal}
        tax={res.tax}
        cost={res.totalCost}
      />

      <OdvodyBox res={res} />

      {(res.warnings.length > 0 || res.sickCompensation > 0 || res.healthDoplatek > 0) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {res.sickCompensation > 0 && (
            <span className="text-gray-600">
              Náhrada za nemoc <b>{kc(res.sickCompensation)}</b> (bez odvodů)
            </span>
          )}
          {res.healthDoplatek > 0 && (
            <span className="text-gray-600">
              z toho doplatek ZP <b>{kc(res.healthDoplatek)}</b>
            </span>
          )}
          {res.taxWithheld && <span className="text-gray-600">srážková daň 15 %</span>}
          {res.warnings.map((w) => (
            <span key={w} className="text-amber-700">
              ⚠ {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
