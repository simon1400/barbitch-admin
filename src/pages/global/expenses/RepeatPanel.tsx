import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiFetch'
import { kc } from '../../../utils/money'
import { btnNeutralCls, btnPinkCls, cardTitleCls, formCardCls, hintCls, inputCls } from '../../../ui/kit'
import {
  CONFIRM_SUM_KC,
  MAX_SUM_KC,
  PAYMENT_LABELS,
  createCostsBatch,
  fetchRepeatCandidates,
  noDphFor,
  type CostInput,
  type CostPayment,
  type CostRow,
  type RepeatCandidate,
} from '../fetch/expenses'

interface Line {
  c: RepeatCandidate
  checked: boolean
  date: string
  sum: string
  /** только для ставки «вручную» */
  noDph: string
  payment: CostPayment | ''
}

const parseSum = (s: string): number => {
  const v = s.replace(/\s/g, '').replace(',', '.')
  return v === '' ? NaN : Number(v)
}

/** Строка → тело затраты или текст ошибки. */
const lineInput = (l: Line): CostInput | string => {
  const sum = parseSum(l.sum)
  if (!Number.isInteger(sum) || sum <= 0) return 'сумма — целое положительное число крон'
  if (sum > MAX_SUM_KC) return 'больше 300 000 Kč'
  const noDph = l.c.vat === 'manual' ? parseSum(l.noDph) : noDphFor(sum, l.c.vat)
  if (!Number.isInteger(noDph) || noDph < 0 || noDph > sum) return 'сумма без DPH — целые кроны, не больше суммы'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return 'неверная дата'
  if (!l.payment) return 'выберите способ оплаты'
  return { date: l.date, name: l.c.name, category: l.c.category, sum, noDph, payment: l.payment, comment: '' }
}

// «Повторить с прошлого месяца» (s237): записи прошлого месяца, которых ещё нет в
// этом; постоянные (были в прошлом и в ≥ 2 из 3 прошлых месяцев) отмечены заранее.
// День, сумма и оплата правятся; создаются одной пачкой — всё или ничего.
export function RepeatPanel({
  month,
  year,
  payments,
  onDone,
  onCancel,
}: {
  month: number
  year: number
  payments: CostPayment[]
  onDone: (rows: CostRow[]) => void
  onCancel: () => void
}) {
  const [lines, setLines] = useState<Line[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchRepeatCandidates(month, year)
      .then((items) => {
        if (!alive) return
        setLines(
          items.map((c) => ({
            c,
            checked: c.recurring,
            date: c.date,
            sum: String(c.sum),
            noDph: String(c.noDph),
            payment: c.payment ?? '',
          })),
        )
      })
      .catch((e: Error) => alive && setLoadError(e.message))
    return () => {
      alive = false
    }
  }, [month, year])

  const set = (i: number, patch: Partial<Line>) =>
    setLines((cur) => (cur ? cur.map((l, j) => (j === i ? { ...l, ...patch } : l)) : cur))

  const picked = useMemo(() => (lines ?? []).filter((l) => l.checked), [lines])
  const problems = picked.map((l) => lineInput(l)).filter((x): x is string => typeof x === 'string')
  const total = picked.reduce((s, l) => s + (Number.isInteger(parseSum(l.sum)) ? parseSum(l.sum) : 0), 0)

  const submit = async () => {
    if (!picked.length || problems.length) return
    const items = picked.map((l) => lineInput(l) as CostInput)
    const big = items.filter((i) => i.sum > CONFIRM_SUM_KC)
    if (big.length && !window.confirm(`${big.map((i) => `«${i.name}» ${kc(i.sum)}`).join(', ')} — больше обычного. Всё верно?`)) return
    setSaving(true)
    setError(null)
    try {
      onDone(await createCostsBatch(items))
    } catch (e) {
      const idx = e instanceof ApiError ? (e.details as { index?: number } | undefined)?.index : undefined
      setError(typeof idx === 'number' && items[idx] ? `«${items[idx].name}»: ${(e as Error).message}` : (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`${formCardCls} mb-3.5`} data-testid="repeat-panel">
      <h2 className={`${cardTitleCls} mb-1`}>Повторить с прошлого месяца</h2>
      <p className={`${hintCls} mt-0 mb-3`}>
        Затраты прошлого месяца, которых ещё нет в этом. Постоянные отмечены заранее — проверьте день, сумму и оплату.
      </p>
      {loadError && (
        <div role="alert" className="mb-3 text-[12.5px] font-semibold text-neg">
          Не удалось загрузить: {loadError}
        </div>
      )}
      {!lines && !loadError && <div className={hintCls}>Загрузка…</div>}
      {lines && lines.length === 0 && (
        <div className={hintCls}>Всё из прошлого месяца уже внесено (или в прошлом месяце затрат не было).</div>
      )}
      {lines && lines.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {lines.map((l, i) => {
            const bad = l.checked ? lineInput(l) : null
            return (
              <li
                key={l.c.sourceId}
                data-source={l.c.sourceId}
                className={`border border-line-soft rounded-lg px-3 py-2 ${l.checked ? '' : 'opacity-60'}`}
              >
                <label className="flex items-center gap-2 text-[14px] font-bold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    name={`pick-${i}`}
                    checked={l.checked}
                    onChange={(e) => set(i, { checked: e.target.checked })}
                  />
                  <span className="min-w-0 flex-1 break-words">{l.c.name}</span>
                  {l.c.recurring && (
                    <span className="text-[11.5px] font-semibold text-ink-faint whitespace-nowrap">
                      постоянная{l.c.usualDay ? ` · обычно ${l.c.usualDay}.` : ''}
                    </span>
                  )}
                </label>
                {l.checked && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="date"
                      name={`date-${i}`}
                      aria-label="Дата"
                      className={`${inputCls} w-full`}
                      value={l.date}
                      onChange={(e) => set(i, { date: e.target.value })}
                    />
                    <input
                      name={`sum-${i}`}
                      aria-label="Сумма с DPH"
                      inputMode="numeric"
                      className={`${inputCls} w-full`}
                      value={l.sum}
                      onChange={(e) => set(i, { sum: e.target.value })}
                    />
                    {l.c.vat === 'manual' ? (
                      <input
                        name={`noDph-${i}`}
                        aria-label="Сумма без DPH"
                        inputMode="numeric"
                        className={`${inputCls} w-full`}
                        value={l.noDph}
                        onChange={(e) => set(i, { noDph: e.target.value })}
                      />
                    ) : (
                      <span className={`${hintCls} self-center`}>
                        {l.c.category} · {l.c.vat ? `DPH ${l.c.vat} %` : 'bez DPH'}
                      </span>
                    )}
                    <select
                      name={`payment-${i}`}
                      aria-label="Способ оплаты"
                      className={`${inputCls} w-full`}
                      value={l.payment}
                      onChange={(e) => set(i, { payment: e.target.value as CostPayment | '' })}
                    >
                      <option value="">— оплата —</option>
                      {payments.map((p) => (
                        <option key={p} value={p}>
                          {PAYMENT_LABELS[p] ?? p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {typeof bad === 'string' && <div className="mt-1 text-[12px] font-normal text-neg">{bad}</div>}
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className={btnPinkCls}
          disabled={saving || picked.length === 0 || problems.length > 0}
          onClick={() => void submit()}
        >
          {saving ? 'Сохраняю…' : `Добавить ${picked.length}${picked.length ? ` · ${kc(total)}` : ''}`}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
          Закрыть
        </button>
      </div>
    </section>
  )
}
