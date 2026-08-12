import { useState, useEffect, useCallback, useMemo } from 'react'
import { Select } from '../../../dashboard/components/Select'
import {
  cardPadCls,
  cardTitleCls,
  countBadgeCls,
  btnPinkCls,
  btnNeutralCls,
  chipCls,
  hintCls,
  inputBaseCls,
  inputCls,
  labelCls,
  mutedCls,
  selectCls,
  toolbarCardCls,
} from '../../../../ui/kit'
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

// Инпут формы во всю ширину (кит + w-full)
const fieldCls = `${inputCls} w-full`
// Подпись плитки результата / строк сверки (без нижнего отступа)
const tileLabCls = 'text-[10px] font-bold tracking-[0.06em] uppercase text-[#8b857f]'
// Кружок-галка внутри чипа-тогла
const chipCheckCls = (on: boolean): string =>
  'inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[9px] shrink-0 ' +
  (on ? 'bg-[#e71e6e] text-white' : 'bg-[#efecea] text-[#efecea]')

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
    { key: 'h', label: 'Zdravotní pojišťovna', calc: totals.health, paid: paidHealth, set: setPaidHealth, tone: 'text-[#2563ac]' },
    { key: 's', label: 'Sociální (ČSSZ)', calc: totals.social, paid: paidSocial, set: setPaidSocial, tone: 'text-[#b0862a]' },
    { key: 't', label: 'Finanční úřad (daň)', calc: totals.tax, paid: paidTax, set: setPaidTax, tone: 'text-[#c53030]' },
  ]

  return (
    <>
      {/* один общий список имён для автокомплита во всех карточках */}
      <datalist id="tax-personals">
        {people.map((p) => (
          <option key={p.documentId} value={p.name} />
        ))}
      </datalist>

      <div className={toolbarCardCls}>
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <span className={mutedCls}>
          Pracovních dnů v měsíci: <b>{fondDays}</b> · данные нигде не сохраняются
        </span>
      </div>

      <div className={cardPadCls}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5">
          <h2 className={`${cardTitleCls} flex items-center gap-2`}>
            Сотрудники за месяц <span className={countBadgeCls}>{results.length}</span>
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setRows((p) => [...p, newRow()])} className={btnPinkCls}>
              ＋ Сотрудник
            </button>
            <button onClick={prefill} disabled={loadingTimeOff} className={btnNeutralCls}>
              {loadingTimeOff ? 'Načítám…' : 'Подставить команду + дни отсутствия'}
            </button>
            <button onClick={() => setRows([newRow()])} className={btnNeutralCls}>
              Очистить
            </button>
          </div>
        </div>

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

        {/* Итог по всем сотрудникам — те же ячейки, что в карточке */}
        <div className="bg-[#faf9f8] rounded-[10px] px-4 py-3.5">
          <div className="mb-2.5 text-[12.5px] font-extrabold text-[#4c4844]">
            Итого за месяц · {results.filter((r) => r.res.gross > 0).length} сотр.
          </div>
          <ResultGrid
            gross={totals.gross}
            health={totals.health}
            social={totals.social}
            tax={totals.tax}
            cost={totals.cost}
            plain
          />
          <OdvodyBox res={totals} totalLabel="Odvody celkem za všechny zaměstnance" />
        </div>
      </div>

      <div className={cardPadCls}>
        <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-x-7 gap-y-[18px]">
          <div>
            <h2 className={cardTitleCls + ' mb-1.5'}>Сверка с платежами</h2>
            <p className={'m-0 ' + hintCls}>
              Введи, сколько реально ушло со счёта за месяц — разница покажет расхождение с
              расчётом по закону.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {checks.map((c) => {
              const paid = num(c.paid)
              const diff = paid - c.calc
              const has = paid > 0
              return (
                <div key={c.key} className="bg-[#faf9f8] rounded-[10px] px-4 py-3.5">
                  <div className={`text-[13px] font-extrabold ${c.tone}`}>{c.label}</div>

                  <div className="flex items-baseline justify-between mt-2.5 mb-3">
                    <span className={tileLabCls}>По расчёту</span>
                    <span className="text-[14px] font-extrabold text-[#161615]">{kc(c.calc)}</span>
                  </div>

                  <label className="block mb-3">
                    <span className={`block ${tileLabCls} mb-[5px]`}>Заплачено фактически</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={c.paid}
                      onChange={(e) => c.set(e.target.value)}
                      placeholder="0"
                      className="w-full box-border bg-white border border-[#e7e2de] rounded-lg px-[11px] py-2 text-[14px] font-semibold text-[#161615] transition-all duration-150 placeholder:text-[#b6b0aa] placeholder:font-medium focus:outline-none focus:border-[#e71e6e] focus:shadow-[0_0_0_3px_rgba(231,30,110,0.1)]"
                    />
                  </label>

                  <div
                    className={`rounded-md px-2 py-1 text-[12px] font-bold text-center ${
                      !has
                        ? 'bg-[#f2efec] text-[#a39e99]'
                        : diff === 0
                          ? 'bg-[#e8f6ee] text-[#1d7a3f]'
                          : 'bg-[#fdecec] text-[#c53030]'
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
        </div>
      </div>

      <div className={cardPadCls}>
        <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-x-7 gap-y-[18px]">
          <div>
            <h2 className={cardTitleCls + ' mb-1.5'}>Параметры года (2026)</h2>
            <p className={'m-0 ' + hintCls}>
              При смене законов поправь здесь — расчёт пересчитается сразу.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
        </div>
      </div>
    </>
  )
}

// Ячейка результата: подпись сверху, сумма снизу. Сетка из таких ячеек
// заменяет широкие колонки таблицы — на телефоне складывается в 2 колонки.
// plain — без плитки-подложки (для блока «Итого», он сам на #faf9f8).
function StatBox({
  label,
  value,
  tone = 'text-[#4c4844]',
  plain,
}: {
  label: string
  value: string
  tone?: string
  plain?: boolean
}) {
  return (
    <div className={plain ? '' : 'bg-[#faf9f8] rounded-lg px-3 py-2.5'}>
      <div className={`${tileLabCls} mb-1`}>{label}</div>
      <div className={`text-[15px] font-extrabold leading-snug ${tone}`}>{value}</div>
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
    <div className="mt-3 bg-[#fce7f0] border border-[#f0a8c8] rounded-lg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className={`${tileLabCls} text-[#b81b60]`}>{totalLabel}</span>
        <span className="text-[19px] font-extrabold text-[#b81b60] leading-none">
          {kc(res.odvodyTotal)}
        </span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-[#8b857f]">
        z toho platí salon navíc <b className="text-[#b81b60]">{kc(res.employerShare)}</b> · sráženo
        ze mzdy zaměstnance <b className="text-[#b81b60]">{kc(res.employeeShare)}</b>
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
  plain,
}: {
  gross: number
  health: number
  social: number
  tax: number
  cost: number
  plain?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <StatBox label="Hrubá mzda" value={gross ? kc(gross) : '—'} plain={plain} />
      <StatBox
        label="Zdravotní"
        value={health ? kc(health) : '—'}
        tone="text-[#2563ac]"
        plain={plain}
      />
      <StatBox
        label="Sociální"
        value={social ? kc(social) : '—'}
        tone="text-[#b0862a]"
        plain={plain}
      />
      <StatBox label="Daň (FÚ)" value={tax ? kc(tax) : '—'} tone="text-[#c53030]" plain={plain} />
      <StatBox
        label="Náklad firmy"
        value={cost ? kc(cost) : '—'}
        tone="text-[#b81b60]"
        plain={plain}
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
      <span className="block text-[10.5px] font-bold tracking-[0.05em] uppercase text-[#8b857f] mb-1.5">
        {label}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${inputBaseCls} w-full rounded-lg px-3 py-[9px] text-[14px]`}
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
          className={`${fieldCls} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#aaa49e] pointer-events-none">
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
    <div className="border border-[#f2efec] rounded-[10px] p-4 mb-3">
      {/* Шапка: имя + тип смлувы + удалить */}
      <div className="grid grid-cols-[minmax(200px,1fr)_130px_34px] gap-2.5 items-end mb-3">
        <label className="block min-w-0">
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
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Smlouva</span>
          <select
            value={row.contract}
            onChange={(e) => onPatch({ contract: e.target.value as ContractType })}
            className={`${selectCls} w-full`}
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
          className="w-[34px] h-[38px] rounded-lg border-0 bg-transparent text-[15px] text-[#c2bcb6] transition-colors hover:bg-[#fdecf2] hover:text-[#d61f61]"
          title="Smazat zaměstnance"
        >
          ✕
        </button>
      </div>

      {/* Ввод: čistá + дни отсутствия */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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

      {/* Чипы-модификаторы расчёта */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {isOsvc ? (
          <span className="text-[12px] font-semibold text-[#a39e99]">
            faktura — salon neodvádí nic
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onPatch({ prohlaseni: !row.prohlaseni })}
              className={chipCls(row.prohlaseni)}
            >
              <span className={chipCheckCls(row.prohlaseni)}>✓</span>
              podepsané prohlášení (sleva)
            </button>
            {row.contract === 'hpp' && (
              <button
                type="button"
                onClick={() => onPatch({ healthMinimum: !row.healthMinimum })}
                className={chipCls(row.healthMinimum)}
              >
                <span className={chipCheckCls(row.healthMinimum)}>✓</span>
                doplatek ZP do minima
              </button>
            )}
            {row.contract === 'dpp' && (
              <button
                type="button"
                onClick={() => onPatch({ dppAboveLimit: !row.dppAboveLimit })}
                className={chipCls(row.dppAboveLimit)}
              >
                <span className={chipCheckCls(row.dppAboveLimit)}>✓</span>
                nad limitem (s odvody)
              </button>
            )}
          </>
        )}
      </div>

      <div className="my-3 border-t border-[#f2efec]" />

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
        <div className="mt-3 space-y-1.5">
          {(res.sickCompensation > 0 || res.healthDoplatek > 0 || res.taxWithheld) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-[#8b857f]">
              {res.sickCompensation > 0 && (
                <span>
                  Náhrada za nemoc <b className="text-[#4c4844]">{kc(res.sickCompensation)}</b>{' '}
                  (bez odvodů)
                </span>
              )}
              {res.healthDoplatek > 0 && (
                <span>
                  z toho doplatek ZP <b className="text-[#4c4844]">{kc(res.healthDoplatek)}</b>
                </span>
              )}
              {res.taxWithheld && <span>srážková daň 15 %</span>}
            </div>
          )}
          {res.warnings.map((w) => (
            <div
              key={w}
              className="rounded-lg bg-[#fbf3e2] text-[#b0862a] text-[12px] font-semibold px-3 py-2"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
