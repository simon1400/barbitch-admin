import { useState } from 'react'
import { ApiError } from '../../../lib/apiFetch'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { kc } from '../../../utils/money'
import { btnDangerCls, btnNeutralCls, btnPinkCls, cardTitleCls, formCardCls, hintCls, inputCls } from '../../../ui/kit'
import {
  PAYMENT_LABELS,
  approveCostRequest,
  cancelCostRequest,
  rejectCostRequest,
  type CostFields,
  type CostRequest,
  type CostRequestAction,
} from '../fetch/expenses'
import { openReceipt } from './receiptFiles'

const ACTION_TITLES: Record<CostRequestAction, string> = {
  edit: 'Изменить',
  delete: 'Удалить',
  file_delete: 'Удалить чек',
}

const FIELD_LABELS: Record<keyof CostFields, string> = {
  date: 'дата',
  name: 'название',
  category: 'категория',
  sum: 'сумма',
  noDph: 'без DPH',
  payment: 'оплата',
  comment: 'комментарий',
}
const FIELD_ORDER = Object.keys(FIELD_LABELS) as (keyof CostFields)[]

const fieldText = (k: keyof CostFields, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (k === 'date') return fmtCsDate(String(v))
  if (k === 'sum' || k === 'noDph') return kc(Number(v))
  if (k === 'payment') return PAYMENT_LABELS[v as keyof typeof PAYMENT_LABELS] ?? String(v)
  return String(v)
}

/** «сумма: 17 000 Kč → 16 500 Kč» по каждому изменённому полю. */
const changeLines = (req: Pick<CostRequest, 'before' | 'changes'>): string[] =>
  FIELD_ORDER.filter((k) => req.changes && k in req.changes).map(
    (k) => `${FIELD_LABELS[k]}: ${fieldText(k, req.before?.[k])} → ${fieldText(k, req.changes?.[k])}`,
  )

const createdText = (iso: string | null) => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '')

// Запросы управляющей на правку и удаление затрат. Владелец — одобряет или
// отклоняет (с причиной); управляющая видит свои и может отозвать.
export function PendingRequests({
  pending,
  isOwner,
  onChanged,
}: {
  pending: CostRequest[]
  isOwner: boolean
  /** что-то решено — странице перечитать месяц; message — что показать */
  onChanged: (message: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')

  if (pending.length === 0) return null

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id)
    setError(null)
    try {
      const msg = await fn()
      setRejecting(null)
      setNote('')
      onChanged(msg)
    } catch (e) {
      setError((e as Error).message)
      // запись изменили или запрос уже закрыт — показать актуальное
      if (e instanceof ApiError && ['cost_changed', 'request_closed', 'not_found', 'request_not_found'].includes(e.code)) {
        onChanged('')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={`${formCardCls} mb-3.5`} data-testid="pending-requests">
      <h2 className={`${cardTitleCls} mb-1`}>
        {isOwner ? 'Ждут одобрения' : 'Мои запросы владельцу'} ({pending.length})
      </h2>
      <p className={`${hintCls} mt-0 mb-3`}>
        {isOwner
          ? 'Управляющая просит изменить или удалить затрату. До решения в итогах месяца — старые суммы.'
          : 'Изменения применятся после одобрения владельца. Пока запрос ждёт, его можно отозвать.'}
      </p>
      {error && (
        <div role="alert" className="mb-3 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}
      <ul className="list-none m-0 p-0 flex flex-col gap-3">
        {pending.map((r) => {
          const cost = r.cost ?? (r.before ? { ...r.before } : null)
          const lines = r.action === 'edit' ? changeLines(r) : []
          const file = r.action === 'file_delete' ? (r.cost?.files.find((f) => f.id === r.fileId) ?? null) : null
          return (
            <li key={r.id} data-request={r.id} className="border border-line-soft rounded-lg px-4 py-3">
              <div className="text-[14px] font-bold text-ink">
                {ACTION_TITLES[r.action]}: «{cost?.name ?? '—'}»{' '}
                {cost ? `${kc(cost.sum)} · ${fmtCsDate(cost.date)}` : ''}
              </div>
              <div className={`${hintCls} mt-0.5`}>
                {r.requestedBy ?? '—'} · {createdText(r.createdAt)}
                {!r.cost && ' · затраты уже нет'}
              </div>
              {r.action === 'file_delete' && (
                <div className="mt-2 text-[13px] font-semibold text-ink-body">
                  {file && r.cost ? (
                    <button
                      type="button"
                      className="bg-transparent border-0 p-0 font-semibold text-brand-dark hover:underline cursor-pointer"
                      onClick={() => {
                        setError(null)
                        openReceipt(r.cost!, file).catch((e: Error) => setError(e.message))
                      }}
                    >
                      📎 {file.fileName}
                    </button>
                  ) : (
                    'чека уже нет'
                  )}
                </div>
              )}
              {lines.length > 0 && (
                <ul className="mt-2 mb-0 pl-4 text-[13px] font-semibold text-ink-body">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}

              {rejecting === r.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    name="rejectNote"
                    className={`${inputCls} flex-1 min-w-[200px]`}
                    placeholder="Причина (необязательно)"
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnDangerCls}
                    disabled={busy === r.id}
                    onClick={() =>
                      run(r.id, async () => {
                        await rejectCostRequest(r.id, note.trim())
                        return 'Запрос отклонён.'
                      })
                    }
                  >
                    Отклонить
                  </button>
                  <button type="button" className={btnNeutralCls} onClick={() => setRejecting(null)}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        className={btnPinkCls}
                        disabled={busy === r.id}
                        onClick={() =>
                          run(r.id, async () => {
                            const res = await approveCostRequest(r.id)
                            return res.deleted ? 'Затрата удалена.' : r.action === 'file_delete' ? 'Чек удалён.' : 'Изменение применено.'
                          })
                        }
                      >
                        {busy === r.id ? '…' : r.action === 'edit' ? 'Одобрить' : 'Одобрить удаление'}
                      </button>
                      <button
                        type="button"
                        className={btnNeutralCls}
                        disabled={busy === r.id}
                        onClick={() => {
                          setRejecting(r.id)
                          setNote('')
                        }}
                      >
                        Отклонить…
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={btnNeutralCls}
                      disabled={busy === r.id}
                      onClick={() =>
                        run(r.id, async () => {
                          await cancelCostRequest(r.id)
                          return 'Запрос отозван.'
                        })
                      }
                    >
                      {busy === r.id ? '…' : 'Отозвать'}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
