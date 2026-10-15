// «Pokladna» модуля «Směna» (s263): строки прихода/расхода, ожидаемый остаток на лету и поле
// «Spočítáno v pokladně», которое вводит человек по пересчёту кассы.
// 🟥 Ожидаемый остаток в поле НЕ подставляется (§3.4 плана): «Uložit» активна только при
// совпадении; не сходится — ищут ошибку в строках или явно «Zapsat rozdíl» с причиной
// (строку-расхождение добавляет сервер, руководство получает push). Строки-расхождения —
// только для чтения. Есть касса позже по дате — суммы заблокированы (цепочка остатков).
import { useMemo, useState } from 'react'

import { ApiError } from '../../../lib/apiFetch'
import { badgeWarnCls, btnDangerCls, btnNeutralCls, btnPinkCls, cardPadCls, cardTitleCls, chipCls, hintCls, inputCls, labelCls, mutedCls, rowInputCls } from '../../../ui/kit'
import { fmtCsDate, fmtTimePrague } from '../../../utils/date'
import {
  INCOME_CHIPS,
  OUTFLOW_CHIPS,
  fmtKc,
  parseKc,
  saveSmenaCash,
  smenaFieldError,
  type FieldError,
  type SmenaDay,
} from '../fetch/smena'

type Kind = 'in' | 'out'
interface Line {
  key: number
  kind: Kind
  amount: string
  comment: string
  /** строка-расхождение, записанная сервером */
  reserved: boolean
}

let keySeq = 1
// день без наличных хранится одной строкой 0 (так пишут на проде) — в форме это «нет строк»
const flowOf = (day: SmenaDay) => {
  const f = day.cash?.flow ?? []
  return f.length === 1 && f[0].sum === 0 ? [] : f
}
const linesOf = (day: SmenaDay): Line[] =>
  flowOf(day).map((f) => ({
    key: keySeq++,
    kind: f.sum < 0 ? 'out' : 'in',
    amount: String(Math.abs(f.sum)),
    comment: f.comment,
    reserved: f.comment.toLowerCase().startsWith(day.discrepancyLabel.toLowerCase()),
  }))

const signed = (l: Line): number | null => {
  const n = parseKc(l.amount)
  return n == null ? null : l.kind === 'out' ? -n : n
}

const fieldErrCls = 'mt-1 text-[12px] font-semibold text-neg'

export function PokladnaCard({ day, onSaved, onReload }: { day: SmenaDay; onSaved: (d: SmenaDay) => void; onReload: () => void }) {
  const cash = day.cash
  const [lines, setLines] = useState<Line[]>(() => linesOf(day))
  const [counted, setCounted] = useState(() => (cash ? String(cash.balance) : ''))
  const [comment, setComment] = useState(() => cash?.comment ?? '')
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<FieldError | null>(null)
  const [stale, setStale] = useState(false)

  const readOnly = !day.editable || !!cash?.closed || day.cashDuplicate
  const sumsLocked = readOnly || day.laterCashExists

  const sums = lines.map(signed)
  const flowSum = sums.reduce<number>((a, s) => a + (s ?? 0), 0)
  const expected = day.prevBalance + flowSum
  const countedN = parseKc(counted)
  const diff = countedN == null ? null : countedN - expected
  // без строк — «bez pohybu» (сервер запишет одну строку 0)
  const linesValid = sums.every((s) => s != null && s !== 0) && lines.every((l) => l.kind === 'in' || l.comment.trim())

  const dirty = useMemo(() => {
    const was = flowOf(day).map((f) => `${f.sum}|${f.comment}`).join('\n')
    const now = lines.map((l) => `${signed(l)}|${l.comment.trim()}`).join('\n')
    return was !== now || (cash ? String(cash.balance) : '') !== counted.trim() || (cash?.comment ?? '') !== comment.trim()
  }, [cash, day, lines, counted, comment])

  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))
  const add = (kind: Kind) => setLines((ls) => [...ls, { key: keySeq++, kind, amount: '', comment: '', reserved: false }])
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key))

  const submit = async (withReason: boolean) => {
    if (countedN == null) return
    setBusy(true)
    setErr(null)
    setStale(false)
    try {
      const res = await saveSmenaCash(day.date, {
        flow: lines.map((l) => ({ sum: signed(l) ?? 0, comment: l.comment.trim() })),
        balance: countedN,
        comment: comment.trim(),
        ...(withReason ? { discrepancyReason: reason.trim() } : {}),
        expectedUpdatedAt: cash?.updatedAt ?? null,
      })
      setReasonOpen(false)
      setReason('')
      onSaved(res)
    } catch (e) {
      setErr(smenaFieldError(e))
      if (e instanceof ApiError && e.code === 'stale') setStale(true)
    } finally {
      setBusy(false)
    }
  }

  const errFor = (field: string, index: number | null = null) =>
    err && err.field === field && (index == null || err.index === index) ? (
      <div className={fieldErrCls} data-field-error={field}>
        {err.text}
      </div>
    ) : null
  // ошибка без своего поля (или поле, которого на экране нет) — общей строкой под формой
  const shownAtField = !!err && ((!!err.field?.startsWith('flow.') && err.index != null) || ['flow', 'balance', 'comment', 'reason'].includes(err.field ?? ''))
  const generalErr = !!err && !shownAtField

  return (
    <section className={cardPadCls} data-card="pokladna" data-testid="smena-pokladna">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h2 className={cardTitleCls}>Pokladna</h2>
        {cash && (
          <span className={mutedCls} data-testid="pokladna-saved">
            Uloženo{cash.lastSavedBy ? ` · ${cash.lastSavedBy}` : ''}
            {cash.updatedAt ? ` · ${fmtTimePrague(cash.updatedAt)}` : ''}
          </span>
        )}
      </div>

      {cash?.closed && <div className={`${hintCls} mb-2`}>Směna je uzavřená vedením — pokladnu už nelze měnit.</div>}
      {day.cashDuplicate && <div className={`${hintCls} mb-2 text-neg`}>Za tento den jsou dvě pokladny — opraví vedení.</div>}
      {!cash?.closed && day.laterCashExists && day.editable && (
        <div className={`${hintCls} mb-2`} data-testid="pokladna-later">
          Pokladna z pozdějšího dne už existuje — částky tohoto dne nejde měnit (rozbily by se zůstatky). Popisy upravit můžete; chybu v částkách
          opraví vedení.
        </div>
      )}

      <div className="text-[13px] font-semibold text-ink-soft mb-3" data-testid="pokladna-prev">
        Zůstatek {day.prevDate ? `z ${fmtCsDate(day.prevDate)}` : '(první záznam)'}: <b className="text-ink">{fmtKc(day.prevBalance)}</b>
      </div>

      <div className="flex flex-col gap-2.5" data-testid="pokladna-lines">
        {lines.map((l, i) => (
          <div key={l.key} className="rounded-lg border border-line-soft bg-surface-tile p-2.5" data-line={i} data-kind={l.kind}>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-extrabold w-[54px] shrink-0 ${l.kind === 'out' ? 'text-neg' : 'text-pos'}`}>{l.kind === 'out' ? 'Výdaj' : 'Příjem'}</span>
              <input
                className={`${rowInputCls} w-[110px] text-right`}
                inputMode="numeric"
                aria-label="Částka v Kč"
                placeholder="0"
                value={l.amount}
                disabled={sumsLocked || l.reserved}
                onChange={(e) => patch(l.key, { amount: e.target.value })}
                data-field="amount"
              />
              <span className={mutedCls}>Kč</span>
              {!sumsLocked && !l.reserved && (
                <button type="button" className="ml-auto text-[13px] font-bold text-ink-faint px-2" aria-label="Smazat řádek" onClick={() => remove(l.key)} data-remove>
                  ✕
                </button>
              )}
            </div>
            {errFor('flow.sum', i)}
            <input
              className={`${rowInputCls} w-full mt-2`}
              placeholder={l.kind === 'out' ? 'Za co (povinné)' : 'Popis (nepovinné)'}
              value={l.comment}
              maxLength={200}
              disabled={readOnly || l.reserved}
              onChange={(e) => patch(l.key, { comment: e.target.value })}
              data-field="comment"
            />
            {!readOnly && !l.reserved && (
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {(l.kind === 'out' ? OUTFLOW_CHIPS : INCOME_CHIPS).map((c) => (
                  <button key={c} type="button" className={chipCls(l.comment === c)} onClick={() => patch(l.key, { comment: c })}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            {errFor('flow.comment', i)}
          </div>
        ))}
        {lines.length === 0 && (
          <div className={hintCls} data-testid="pokladna-empty">
            Žádný pohyb hotovosti. Přidejte příjem nebo výdaj — nebo, pokud dnes hotovost nebyla, jen zapište spočítaný zůstatek.
          </div>
        )}
      </div>
      {errFor('flow')}

      {!sumsLocked && (
        <div className="flex gap-2 mt-2.5">
          <button type="button" className={btnNeutralCls} onClick={() => add('in')} data-add="in">
            + Příjem
          </button>
          <button type="button" className={btnNeutralCls} onClick={() => add('out')} data-add="out">
            − Výdaj
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3 flex flex-col gap-3">
        <div className="text-[14px] font-bold text-ink-body" data-testid="pokladna-expected">
          Očekávaný zůstatek: <span className="text-ink">{fmtKc(expected)}</span>
        </div>
        <label className="block">
          <span className={labelCls}>Spočítáno v pokladně (Kč)</span>
          <input
            className={`${inputCls} w-full max-w-[220px]`}
            inputMode="numeric"
            value={counted}
            disabled={sumsLocked}
            placeholder="kolik je skutečně v pokladně"
            onChange={(e) => setCounted(e.target.value)}
            data-field="balance"
          />
          {counted.trim() !== '' && countedN == null && <div className={fieldErrCls}>Celé koruny, bez haléřů.</div>}
          {diff === 0 && linesValid && (
            <div className="mt-1 text-[12.5px] font-bold text-pos" data-testid="pokladna-match">
              ✓ Sedí
            </div>
          )}
          {diff != null && diff !== 0 && (
            <div className="mt-1 text-[12.5px] font-bold text-neg" data-testid="pokladna-diff">
              Rozdíl {fmtKc(diff)} — zkontrolujte řádky
            </div>
          )}
          {errFor('balance')}
        </label>
        <label className="block">
          <span className={labelCls}>Poznámka ke dni (nepovinné)</span>
          <input className={`${inputCls} w-full`} value={comment} maxLength={500} disabled={readOnly} onChange={(e) => setComment(e.target.value)} data-field="day-comment" />
          {errFor('comment')}
        </label>

        {reasonOpen && diff != null && diff !== 0 && !readOnly && (
          <div className="rounded-lg border border-warn-line bg-warn-bg p-3" data-testid="pokladna-reason">
            <div className="text-[13px] font-bold text-ink mb-1">
              Zapsat rozdíl {fmtKc(diff)} <span className={badgeWarnCls}>vedení dostane upozornění</span>
            </div>
            <div className={`${hintCls} mb-2`}>Do pokladny se přidá řádek „{day.discrepancyLabel}: …“ s vaším důvodem. Nejdřív zkontrolujte, že je v řádcích všechno.</div>
            <input className={`${inputCls} w-full`} placeholder="Důvod (povinné)" value={reason} maxLength={150} onChange={(e) => setReason(e.target.value)} data-field="reason" />
            {errFor('reason')}
          </div>
        )}

        {generalErr && <div className={fieldErrCls} data-field-error="general">{err?.text}</div>}
        {stale && (
          <button type="button" className={`${btnNeutralCls} self-start`} onClick={onReload}>
            Načíst znovu
          </button>
        )}

        {!readOnly && (
          <div className="flex gap-2 flex-wrap">
            {diff != null && diff !== 0 && !sumsLocked ? (
              reasonOpen ? (
                <>
                  <button type="button" className={btnDangerCls} disabled={busy || !linesValid || reason.trim().length < 3} onClick={() => void submit(true)} data-save="reason">
                    {busy ? 'Ukládám…' : 'Uložit s rozdílem'}
                  </button>
                  <button type="button" className={btnNeutralCls} onClick={() => setReasonOpen(false)}>
                    Zpět
                  </button>
                </>
              ) : (
                <button type="button" className={btnNeutralCls} disabled={!linesValid} onClick={() => setReasonOpen(true)} data-open-reason>
                  Zapsat rozdíl…
                </button>
              )
            ) : (
              <button type="button" className={btnPinkCls} disabled={busy || !dirty || !linesValid || diff !== 0} onClick={() => void submit(false)} data-save="cash">
                {busy ? 'Ukládám…' : cash ? 'Uložit změny' : 'Uložit pokladnu'}
              </button>
            )}
          </div>
        )}
        {!readOnly && !linesValid && lines.length > 0 && <div className={mutedCls}>U každého řádku vyplňte částku (ne 0), u výdaje i za co.</div>}
      </div>
    </section>
  )
}
