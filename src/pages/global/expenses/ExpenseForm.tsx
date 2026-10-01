import { useMemo, useState } from 'react'
import { fmtCsDate } from '../../../utils/date'
import { kc } from '../../../utils/money'
import {
  btnDangerCls,
  btnNeutralCls,
  btnPinkCls,
  cardTitleCls,
  formCardCls,
  hintCls,
  inputCls,
  labelCls,
  pillCls,
} from '../../../ui/kit'
import {
  CONFIRM_SUM_KC,
  MAX_SUM_KC,
  PAYMENT_LABELS,
  REQUEST_LABELS,
  VAT_OPTIONS,
  createCost,
  deleteCost,
  diffInput,
  findDuplicates,
  nameKey,
  noDphFor,
  requestCostChange,
  updateCost,
  uploadCostFile,
  type CostInput,
  type CostPayment,
  type CostRow,
  type CostSuggestion,
  type CostVat,
} from '../fetch/expenses'
import { ReceiptList, ReceiptPicker } from './Receipts'

/** Что произошло — странице, чтобы перечитать месяц и показать сообщение. */
export type ExpenseFormResult =
  /** fileErrors — затрата создана, но эти чеки не загрузились */
  | { kind: 'created'; row: CostRow; fileErrors: string[] }
  | { kind: 'updated'; row: CostRow }
  | { kind: 'deleted'; row: CostRow }
  | { kind: 'requested'; action: 'edit' | 'delete' | 'file_delete'; row: CostRow }

const parseSum = (s: string): number => {
  const v = s.replace(/\s/g, '').replace(',', '.')
  return v === '' ? NaN : Number(v)
}

const isWhole = (n: number) => Number.isInteger(n) && n >= 0

// Форма затраты: создание (руководство) и правка. Правку и удаление владелец делает
// сразу; управляющая отправляет запрос на одобрение. Сервер перепроверяет всё то же
// самое — здесь только чтобы кнопка не отправляла заведомо пустое, плюс два
// предупреждения, которых сервер не делает: возможный дубль и большая сумма.
export function ExpenseForm({
  row,
  isOwner,
  categories,
  payments,
  suggestions,
  monthRows,
  defaultDate,
  onDone,
  onCancel,
  onFilesChanged,
}: {
  /** null — новая затрата */
  row: CostRow | null
  isOwner: boolean
  categories: string[]
  payments: CostPayment[]
  suggestions: CostSuggestion[]
  /** записи открытого месяца — для предупреждения о дубле */
  monthRows: CostRow[]
  defaultDate: string
  onDone: (r: ExpenseFormResult) => void
  onCancel: () => void
  /** к существующей затрате приложили или удалили чек — перечитать месяц */
  onFilesChanged: () => void
}) {
  const [date, setDate] = useState(row?.date ?? defaultDate)
  const [name, setName] = useState(row?.name ?? '')
  const [category, setCategory] = useState(row?.category ?? '')
  const [sum, setSum] = useState(row ? String(row.sum) : '')
  const [vat, setVat] = useState<CostVat>(row?.vat ?? 21)
  const [manualNoDph, setManualNoDph] = useState(row && row.vat === 'manual' ? String(row.noDph) : '')
  const [payment, setPayment] = useState<CostPayment | ''>(row?.payment ?? '')
  const [comment, setComment] = useState(row?.comment ?? '')
  const [showComment, setShowComment] = useState(!!row?.comment)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // дубль показан — второе нажатие сохраняет
  const [dupAck, setDupAck] = useState(false)
  // чеки новой затраты — грузятся сразу после создания
  const [receipts, setReceipts] = useState<File[]>([])

  const editing = row !== null
  const locked = editing && !isOwner && row.pendingRequest !== null

  const sumNum = parseSum(sum)
  const sumOk = Number.isInteger(sumNum) && sumNum > 0 && sumNum <= MAX_SUM_KC
  const noDph = vat === 'manual' ? parseSum(manualNoDph) : sumOk ? noDphFor(sumNum, vat) : NaN
  const noDphOk = isWhole(noDph) && sumOk && noDph <= sumNum

  const canSave =
    !saving && !locked && !!date && name.trim() !== '' && !!category && sumOk && noDphOk && payment !== ''

  const duplicates = useMemo(
    () => (sumOk ? findDuplicates(monthRows, { date, name, sum: sumNum }, row?.documentId) : []),
    [monthRows, date, name, sumNum, sumOk, row?.documentId],
  )

  // автодополнение: выбранное название подставляет категорию, ставку, оплату и сумму
  const applySuggestion = (value: string) => {
    setName(value)
    setDupAck(false)
    if (editing) return
    const s = suggestions.find((x) => nameKey(x.name) === nameKey(value))
    if (!s) return
    if (s.category && categories.includes(s.category)) setCategory(s.category)
    setVat(s.vat)
    if (s.payment) setPayment(s.payment)
    if (sum === '') setSum(String(s.lastSum))
    if (s.vat === 'manual') setManualNoDph('')
  }

  const input = (): CostInput => ({
    date,
    name: name.trim(),
    category,
    sum: sumNum,
    noDph,
    payment: payment as CostPayment,
    comment: comment.trim(),
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    if (duplicates.length > 0 && !dupAck) {
      setDupAck(true)
      return
    }
    if (sumNum > CONFIRM_SUM_KC && !window.confirm(`Сумма ${kc(sumNum)} — больше обычного. Всё верно?`)) return
    setSaving(true)
    setError(null)
    try {
      if (!editing) {
        const created = await createCost(input())
        const fileErrors: string[] = []
        for (const f of receipts) {
          try {
            await uploadCostFile(created, f)
          } catch (err) {
            fileErrors.push(`«${f.name}»: ${(err as Error).message}`)
          }
        }
        onDone({ kind: 'created', row: created, fileErrors })
        return
      }
      const changes = diffInput(row, input())
      if (Object.keys(changes).length === 0) {
        setError('Ничего не изменилось.')
        return
      }
      if (isOwner) {
        onDone({ kind: 'updated', row: await updateCost(row, changes) })
      } else {
        await requestCostChange(row, 'edit', changes)
        onDone({ kind: 'requested', action: 'edit', row })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row) return
    const what = `«${row.name}» ${kc(row.sum)} от ${fmtCsDate(row.date)}`
    const q = isOwner
      ? `Удалить затрату ${what}? Это навсегда.`
      : `Отправить владельцу запрос на удаление ${what}?`
    if (!window.confirm(q)) return
    setSaving(true)
    setError(null)
    try {
      if (isOwner) {
        await deleteCost(row)
        onDone({ kind: 'deleted', row })
      } else {
        await requestCostChange(row, 'delete')
        onDone({ kind: 'requested', action: 'delete', row })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const saveLabel = saving ? (receipts.length && !editing ? 'Сохраняю и загружаю чек…' : 'Сохраняю…') : !editing ? 'Добавить' : isOwner ? 'Сохранить' : 'Отправить на одобрение'

  return (
    <form onSubmit={submit} className={`${formCardCls} mb-3.5`} data-testid="expense-form">
      <h2 className={`${cardTitleCls} mb-4`}>
        {editing ? `Затрата «${row.name}»` : 'Новая затрата'}
      </h2>

      {editing && (
        <div className={`${hintCls} mb-3`}>
          Внёс: {row.author ?? 'панель Strapi'}
          {!isOwner && ' · изменения и удаление применятся после одобрения владельца'}
        </div>
      )}
      {locked && (
        <div role="status" className="mb-3 text-[12.5px] font-semibold text-warn">
          По этой затрате уже есть запрос ({row.pendingRequest ? REQUEST_LABELS[row.pendingRequest.action] : ''}) —
          дождитесь решения владельца или отзовите его.
        </div>
      )}

      <fieldset disabled={locked || saving} className="m-0 p-0 border-0 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block">
            <span className={labelCls}>Дата</span>
            <input
              name="date"
              type="date"
              className={`${inputCls} w-full`}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setDupAck(false)
              }}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Название</span>
            <input
              name="name"
              className={`${inputCls} w-full`}
              value={name}
              maxLength={120}
              list="expense-names"
              autoComplete="off"
              onChange={(e) => applySuggestion(e.target.value)}
            />
            <datalist id="expense-names">
              {suggestions.map((s) => (
                <option key={nameKey(s.name)} value={s.name}>
                  {`${kc(s.lastSum)} · ${fmtCsDate(s.lastDate)}`}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={labelCls}>Категория</span>
            <select
              name="category"
              className={`${inputCls} w-full`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— выберите —</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Способ оплаты</span>
            <select
              name="payment"
              className={`${inputCls} w-full`}
              value={payment}
              onChange={(e) => setPayment(e.target.value as CostPayment | '')}
            >
              <option value="">— выберите —</option>
              {payments.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_LABELS[p] ?? p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Сумма с DPH, Kč</span>
            <input
              name="sum"
              inputMode="numeric"
              className={`${inputCls} w-full`}
              value={sum}
              placeholder="0"
              onChange={(e) => {
                setSum(e.target.value)
                setDupAck(false)
              }}
            />
          </label>
          <div>
            <span className={labelCls}>DPH</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-1" role="radiogroup" aria-label="DPH">
              {VAT_OPTIONS.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={vat === o.value}
                  data-vat={String(o.value)}
                  className={pillCls(vat === o.value)}
                  onClick={() => {
                    setVat(o.value)
                    if (o.value === 'manual' && manualNoDph === '' && noDphOk) setManualNoDph(String(noDph))
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {vat === 'manual' ? (
              <label className="block mt-2">
                <span className={labelCls}>Сумма без DPH, Kč</span>
                <input
                  name="noDph"
                  inputMode="numeric"
                  className={`${inputCls} w-full`}
                  value={manualNoDph}
                  onChange={(e) => setManualNoDph(e.target.value)}
                />
              </label>
            ) : (
              <div className={`${hintCls} mt-2`} data-testid="no-dph">
                Без DPH: {noDphOk ? kc(noDph) : '—'}
              </div>
            )}
          </div>
          {showComment ? (
            <label className="block sm:col-span-2">
              <span className={labelCls}>Комментарий (необязательно)</span>
              <input
                name="comment"
                className={`${inputCls} w-full`}
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
          ) : (
            <div className="sm:col-span-2">
              <button type="button" className={btnNeutralCls} onClick={() => setShowComment(true)}>
                + Комментарий
              </button>
            </div>
          )}
          {!editing && <ReceiptPicker files={receipts} onChange={setReceipts} />}
        </div>
      </fieldset>

      {editing && (
        <ReceiptList
          row={row}
          isOwner={isOwner}
          onFilesChanged={onFilesChanged}
          onRequested={() => onDone({ kind: 'requested', action: 'file_delete', row })}
        />
      )}

      {sum !== '' && !sumOk && (
        <div className="mt-2 text-[12px] font-normal text-neg">
          {Number.isFinite(sumNum) && sumNum > MAX_SUM_KC
            ? 'Больше 300 000 Kč — проверьте, нет ли лишнего нуля.'
            : 'Сумма — целое положительное число крон.'}
        </div>
      )}
      {vat === 'manual' && manualNoDph !== '' && !noDphOk && sumOk && (
        <div className="mt-2 text-[12px] font-normal text-neg">Сумма без DPH — целые кроны, не больше суммы.</div>
      )}
      {duplicates.length > 0 && (
        <div role="status" data-testid="dup-warning" className="mt-3 text-[12.5px] font-semibold text-warn">
          Похоже на дубль: {duplicates.map((d) => `«${d.name}» ${kc(d.sum)}`).join(', ')} от {fmtCsDate(date)} уже
          есть.{dupAck ? ' Нажмите ещё раз, чтобы сохранить всё равно.' : ''}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="submit" className={btnPinkCls} disabled={!canSave}>
          {saveLabel}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
          {editing ? 'Закрыть' : 'Отмена'}
        </button>
        {editing && (
          <button type="button" className={`${btnDangerCls} ml-auto`} onClick={remove} disabled={saving || locked}>
            {isOwner ? 'Удалить' : 'Запросить удаление'}
          </button>
        )}
      </div>
      {!editing && (
        <p className={`${hintCls} mt-3 mb-0`}>
          Затрата сразу входит в «Результат за месяц» месяца её даты.
          {!isOwner && ' Исправить или удалить её потом можно только через одобрение владельца — проверьте сумму.'}
        </p>
      )}
    </form>
  )
}
