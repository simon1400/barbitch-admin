import { useMonthYear } from '../../../../hooks/useMonthYear'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Select } from '../../../dashboard/components/Select'
import {
  cardPadCls,
  cardTitleCls,
  countBadgeCls,
  btnPinkCls,
  btnNeutralCls,
  hintCls,
  mutedCls,
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


import { kc } from '../../../../utils/money'
import { todayYmd } from '../../../../utils/date'
import { Toast, type ToastMessage } from '../../../../components/Toast'
import { periodLabel, type CorrectionRow } from '../fetch/corrections'
import { newRow, type Row } from './taxes/model'
import { tileLabCls } from './taxes/styles'
import { OdvodyBox, ResultGrid } from './taxes/ResultBoxes'
import { ParamInput } from './taxes/Fields'
import { EmployeeCard } from './taxes/EmployeeCard'
import { TaxWriteBlock } from './taxes/TaxWriteBlock'
import { fetchWrittenTaxes, periodOfTab, taxEntriesFor, writeTaxCorrections } from './taxes/writeTaxes'
const num = (s: string): number => {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default function TaxesTab() {
  const { month, setMonth, year, setYear } = useMonthYear()
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

  // s285: уплаченные налоги пишутся в «Корректировки» за месяц расчёта (period),
  // датой сегодня. Уже записанные за месяц — чтобы не задвоить и показать «записано».
  const period = periodOfTab(month, year)
  const [written, setWritten] = useState<Map<string, CorrectionRow[]>>(new Map())
  const [writing, setWriting] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])
  const showToast = (text: string, tone: ToastMessage['tone'] = 'ok') => setToast({ id: Date.now(), text, tone })
  useEffect(() => {
    let alive = true
    setWritten(new Map())
    fetchWrittenTaxes(month, year)
      .then((m) => {
        if (alive) setWritten(m)
      })
      .catch(() => {
        /* список корректировок недоступен — кнопка всё равно работает, просто без «записано» */
      })
    return () => {
      alive = false
    }
  }, [month, year])

  const personOf = useCallback((name: string) => people.find((p) => p.name === name) ?? null, [people])

  const writeFor = async (targets: { row: Row; res: EmployeeTaxResult }[], all: boolean) => {
    const date = todayYmd()
    const done: string[] = []
    let total = 0
    for (const { row, res } of targets) {
      const person = personOf(row.name)
      const entries = taxEntriesFor(res)
      if (!person || entries.length === 0) continue
      const existing = written.get(person.documentId) ?? []
      if (existing.length > 0) {
        if (all) continue // «всем» — только тех, за кого ещё не записано
        const q = `За ${person.name} ${periodLabel(period)} налоги уже записаны (${kc(existing.reduce((a, r) => a + r.sum, 0))}). Записать ещё раз?`
        if (!window.confirm(q)) return
      }
      setWriting(person.documentId)
      const r = await writeTaxCorrections({ personal: person.documentId, period, date, entries })
      if (r.rows.length > 0) {
        setWritten((prev) => {
          const next = new Map(prev)
          next.set(person.documentId, [...(next.get(person.documentId) ?? []), ...r.rows])
          return next
        })
        done.push(person.name)
        total += r.rows.reduce((a, x) => a + x.sum, 0)
      }
      if (r.error) {
        setWriting(null)
        showToast(`${person.name}: ${r.error.message}${r.rows.length ? ` (записано ${r.rows.length} из ${entries.length})` : ''}`, 'info')
        return
      }
    }
    setWriting(null)
    if (done.length === 0) showToast(all ? 'Записывать некого: у всех либо уже записано, либо нет сотрудника из списка.' : 'Нечего записывать.', 'info')
    else showToast(`Записано ${periodLabel(period)}: ${done.join(', ')} · ${kc(total)}. Видно в «Корректировки» и «Зарплаты».`)
  }

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
    { key: 'h', label: 'Zdravotní pojišťovna', calc: totals.health, paid: paidHealth, set: setPaidHealth, tone: 'text-info' },
    { key: 's', label: 'Sociální (ČSSZ)', calc: totals.social, paid: paidSocial, set: setPaidSocial, tone: 'text-warn' },
    { key: 't', label: 'Finanční úřad (daň)', calc: totals.tax, paid: paidTax, set: setPaidTax, tone: 'text-neg' },
  ]

  return (
    <>
      <Toast message={toast} onClose={closeToast} />
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
            <span data-testid="tax-write-all">
              <button
                type="button"
                onClick={() => writeFor(results, true)}
                disabled={!!writing || !results.some(({ row, res }) => personOf(row.name) && taxEntriesFor(res).length > 0 && !(written.get(personOf(row.name)!.documentId)?.length))}
                className={btnNeutralCls}
                title="Записать налоги в «Корректировки» за всех, за кого ещё не записано"
              >
                {writing ? 'Записываю…' : `Записать налоги всем · ${periodLabel(period)}`}
              </button>
              <span data-tax-write-end="true"></span>
            </span>
          </div>
        </div>

        {results.map(({ row, res }) => {
          const person = personOf(row.name)
          return (
            <EmployeeCard
              key={row.id}
              row={row}
              res={res}
              people={people}
              onPatch={(p) => patch(row.id, p)}
              onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              footer={
                res.gross > 0 && row.contract !== 'osvc' ? (
                  <TaxWriteBlock
                    personDocId={person?.documentId ?? null}
                    entries={taxEntriesFor(res)}
                    existing={person ? (written.get(person.documentId) ?? []) : []}
                    period={period}
                    busy={!!writing}
                    onWrite={() => writeFor([{ row, res }], false)}
                  />
                ) : null
              }
            />
          )
        })}

        {/* Итог по всем сотрудникам — те же ячейки, что в карточке */}
        <div className="bg-surface-tile rounded-[10px] px-4 py-3.5">
          <div className="mb-2.5 text-[12.5px] font-extrabold text-ink-body">
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
                <div key={c.key} className="bg-surface-tile rounded-[10px] px-4 py-3.5">
                  <div className={`text-[13px] font-extrabold ${c.tone}`}>{c.label}</div>

                  <div className="flex items-baseline justify-between mt-2.5 mb-3">
                    <span className={tileLabCls}>По расчёту</span>
                    <span className="text-[14px] font-extrabold text-ink">{kc(c.calc)}</span>
                  </div>

                  <label className="block mb-3">
                    <span className={`block ${tileLabCls} mb-[5px]`}>Заплачено фактически</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={c.paid}
                      onChange={(e) => c.set(e.target.value)}
                      placeholder="0"
                      className="w-full box-border bg-white border border-line-btn rounded-lg px-[11px] py-2 text-[14px] font-semibold text-ink transition-all duration-150 placeholder:text-ink-placeholder placeholder:font-medium focus:outline-none focus:border-brand focus:shadow-focus"
                    />
                  </label>

                  <div
                    className={`rounded-md px-2 py-1 text-[12px] font-bold text-center ${
                      !has
                        ? 'bg-line-soft text-ink-faint'
                        : diff === 0
                          ? 'bg-pos-bg text-pos'
                          : 'bg-neg-bg text-neg'
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
