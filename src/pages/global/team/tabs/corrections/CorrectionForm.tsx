import { useState } from 'react'
import type { InternalRecipient } from '../../../../../lib/personals'
import { btnPinkCls, cardTitleCls, formCardCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import {
  CORRECTION_KINDS,
  KIND_ORDER,
  TAX_TYPE_LABELS,
  createCorrection,
  type CorrectionKind,
  type CorrectionRow,
  type TaxType,
} from '../../fetch/corrections'

const POSITION_LABEL: Record<string, string> = {
  master: 'мастер',
  administrator: 'администратор',
  manager: 'управляющая',
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/

// Форма новой корректировки. Сервер перепроверяет всё то же самое (сумма, дата,
// «за что», месяц выплаты) — здесь только чтобы кнопка не отправляла заведомо пустое.
//
// s285: у аванса, выплаты и налога два поля времени — «Дата» (когда реально
// выплачено; по умолчанию сегодня) и «За какой месяц» (куда запись попадает в
// «Зарплатах»; по умолчанию прошлый месяц — владелец платит за прошлый).
export function CorrectionForm({
  staff,
  defaultDate,
  defaultPeriod,
  today,
  onCreated,
}: {
  staff: InternalRecipient[]
  defaultDate: string
  /** месяц выплаты по умолчанию, YYYY-MM */
  defaultPeriod: string
  /** пражское сегодня — дата выплаты по умолчанию у типов с периодом */
  today: string
  onCreated: (row: CorrectionRow) => void
}) {
  const [kind, setKind] = useState<CorrectionKind>('penalty')
  const [personal, setPersonal] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [period, setPeriod] = useState(defaultPeriod)
  const [sum, setSum] = useState('')
  const [text, setText] = useState('')
  const [taxType, setTaxType] = useState<TaxType>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = CORRECTION_KINDS[kind]
  const sumNum = Number(sum.replace(/\s/g, ''))
  const sumOk = Number.isInteger(sumNum) && sumNum > 0
  const periodOk = !meta.hasPeriod || YM_RE.test(period)
  const canSave = !saving && !!personal && !!date && sumOk && periodOk && (!meta.textRequired || text.trim() !== '')

  // смена типа: у выплаты дата — сегодня (реальный день), у штрафа — дата открытого месяца
  const changeKind = (next: CorrectionKind) => {
    const was = CORRECTION_KINDS[kind].hasPeriod
    const now = CORRECTION_KINDS[next].hasPeriod
    if (now && !was) setDate(today)
    if (!now && was) setDate(defaultDate)
    setKind(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const row = await createCorrection({
        kind,
        personal,
        date,
        sum: sumNum,
        text: text.trim(),
        // месяц выплаты — только у аванса/выплаты/налога (s285)
        ...(meta.hasPeriod ? { period } : {}),
        // вид налога уходит только у налога — у остальных коллекций поля type нет
        ...(kind === 'tax' ? { taxType } : {}),
      })
      // сотрудник и дата остаются — удобно завести несколько записей подряд
      setSum('')
      setText('')
      onCreated(row)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${formCardCls} mb-3.5`} data-testid="correction-form">
      <h2 className={`${cardTitleCls} mb-4`}>Новая корректировка</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className={labelCls}>Тип</span>
          <select
            name="kind"
            className={`${inputCls} w-full`}
            value={kind}
            onChange={(e) => changeKind(e.target.value as CorrectionKind)}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {CORRECTION_KINDS[k].label} ({CORRECTION_KINDS[k].effect})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Сотрудник</span>
          <select
            name="personal"
            className={`${inputCls} w-full`}
            value={personal}
            onChange={(e) => setPersonal(e.target.value)}
          >
            <option value="">— выберите —</option>
            {staff.map((p) => (
              <option key={p.docId} value={p.docId}>
                {p.name}
                {p.position && POSITION_LABEL[p.position] ? ` · ${POSITION_LABEL[p.position]}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{meta.hasPeriod ? 'Дата выплаты' : 'Дата'}</span>
          <input
            name="date"
            type="date"
            className={`${inputCls} w-full`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {meta.hasPeriod && (
          <label className="block">
            <span className={labelCls}>За какой месяц</span>
            <input
              name="period"
              type="month"
              className={`${inputCls} w-full`}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Сумма, Kč</span>
          <input
            name="sum"
            inputMode="numeric"
            className={`${inputCls} w-full`}
            value={sum}
            placeholder="0"
            onChange={(e) => setSum(e.target.value)}
          />
        </label>
        {kind === 'tax' && (
          <label className="block sm:col-span-2">
            <span className={labelCls}>Вид налога</span>
            <select
              name="taxType"
              className={`${inputCls} w-full`}
              value={taxType}
              onChange={(e) => setTaxType(e.target.value as TaxType)}
            >
              {(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((t) => (
                <option key={t} value={t}>
                  {TAX_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className={labelCls}>
            {meta.textLabel}
            {meta.textRequired ? '' : ' (необязательно)'}
          </span>
          <input
            name="text"
            className={`${inputCls} w-full`}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>

      {sum !== '' && !sumOk && (
        <div className="mt-2 text-[12px] font-normal text-neg">Сумма — целое положительное число крон.</div>
      )}
      {meta.hasPeriod && (
        <div className="mt-2 text-[12px] font-normal text-ink-soft" data-testid="correction-period-hint">
          Дата — когда реально выплачено. В «Зарплаты» запись попадёт за выбранный месяц, а не за месяц даты.
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="submit" className={btnPinkCls} disabled={!canSave}>
          {saving ? 'Сохраняю…' : 'Добавить'}
        </button>
        <span className={hintCls}>
          Запись сразу попадает в «Зарплаты» своего месяца (у аванса, выплаты и налога — месяца «за
          какой», у остальных — месяца даты). Мастеру без услуг в этом месяце (администратору без
          смен) строка в «Зарплатах» не появится — запись будет видна здесь.
        </span>
      </div>
    </form>
  )
}
