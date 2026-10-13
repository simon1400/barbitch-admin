// Новые затраты со склада (s252, план STOCK_NEXT_SESSION_PROMPT.md §0.5): администратор принял заказ и
// вписал сумму из чека — прав на затраты у него нет, поэтому сервер создал ЗАПРОС. Одобряют по очереди:
// сначала управляющая (её «Одобрить» передаёт владельцу), потом владелец — тогда затрата и появляется.
// Владелец может одобрить сразу, на любой ступени. Перед одобрением можно поправить сумму, ставку,
// оплату, дату, название и категорию. Отклонить — затрата не создаётся (приход в складе остаётся,
// в заказе — «Náklad zamítnut», руководство может вписать затрату там же).
import { useState } from 'react'

import { ApiError } from '../../../lib/apiFetch'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { kc } from '../../../utils/money'
import { badgeNeutralCls, badgeWarnCls, btnNeutralCls, btnPinkCls, cardTitleCls, formCardCls, hintCls, inputCls, pillCls, selectCls } from '../../../ui/kit'
import {
  PAYMENT_LABELS,
  approveCostRequest,
  noDphFor,
  rejectCostRequest,
  type CostPayment,
  type CostRequest,
} from '../fetch/expenses'
import { openRequestReceipt } from './receiptFiles'

const VATS = [21, 12, 0] as const
type Vat = (typeof VATS)[number]
const VAT_LABEL: Record<Vat, string> = { 21: '21 %', 12: '12 %', 0: 'bez DPH' }

/** Ставка по паре сумм (как сервер); смешанный чек — 21. */
const vatOf = (sum: number, noDph: number): Vat =>
  noDph === sum ? 0 : Math.abs(noDph - sum / 1.12) <= 1 ? 12 : 21

const createdText = (iso: string | null) => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '')

interface Draft {
  name: string
  date: string
  sum: string
  vat: Vat
  payment: CostPayment
  category: string
}

function Item({
  r,
  isOwner,
  categories,
  payments,
  onChanged,
}: {
  r: CostRequest
  isOwner: boolean
  categories: string[]
  payments: CostPayment[]
  onChanged: (message: string) => void
}) {
  const c = r.changes ?? {}
  const sum = Number(c.sum) || 0
  const canDecide = isOwner || r.stage === 'manager'
  const [mode, setMode] = useState<null | 'edit' | 'reject'>(null)
  const [draft, setDraft] = useState<Draft>({
    name: c.name ?? '',
    date: c.date ?? '',
    sum: String(sum || ''),
    vat: vatOf(sum, Number(c.noDph) || 0),
    payment: (c.payment as CostPayment) || 'card',
    category: c.category ?? categories[0] ?? '',
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    try {
      const msg = await fn()
      setMode(null)
      onChanged(msg)
    } catch (e) {
      setError((e as Error).message)
      if (e instanceof ApiError && ['request_closed', 'request_not_found', 'request_at_owner'].includes(e.code)) onChanged('')
    } finally {
      setBusy(false)
    }
  }

  const approve = (withChanges: boolean) =>
    run(async () => {
      const s = Number(draft.sum.replace(/\s/g, '').replace(',', '.'))
      await approveCostRequest(
        r.id,
        withChanges
          ? { name: draft.name, date: draft.date, sum: s, noDph: Number.isFinite(s) ? noDphFor(s, draft.vat) : s, payment: draft.payment, category: draft.category }
          : undefined,
      )
      return isOwner ? 'Затрата со склада добавлена.' : 'Одобрено — передано владельцу.'
    })

  return (
    <li data-stock-request={r.id} data-stage={r.stage ?? ''} className="border border-line-soft rounded-lg px-4 py-3">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0 text-[14px] font-bold text-ink">
          «{c.name ?? '—'}» {kc(sum)} · {c.date ? fmtCsDate(c.date) : '—'}
        </div>
        <span className={r.stage === 'owner' ? badgeNeutralCls : badgeWarnCls} data-stage-badge>
          {r.stage === 'owner' ? 'ждёт владельца' : 'ждёт управляющую'}
        </span>
      </div>
      <div className={`${hintCls} mt-0.5`}>
        принял(а) {r.requestedBy ?? '—'} · {createdText(r.createdAt)}
        {c.payment && ` · ${PAYMENT_LABELS[c.payment as CostPayment] ?? c.payment}`}
        {r.managerApprovedBy && ` · одобрила ${r.managerApprovedBy}`}
      </div>
      {c.comment && <div className="mt-1 text-[13px] font-semibold text-ink-body">{c.comment}</div>}
      {r.files.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3">
          {r.files.map((f) => (
            <button
              key={f.id}
              type="button"
              className="bg-transparent border-0 p-0 text-[13px] font-semibold text-brand-dark hover:underline cursor-pointer"
              onClick={() => {
                setError(null)
                openRequestReceipt(r.id, f).catch((e: Error) => setError(e.message))
              }}
            >
              📎 {f.fileName}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-2 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}

      {!canDecide ? (
        <div className={`${hintCls} mt-2`}>Передано владельцу — решение за ним.</div>
      ) : mode === 'edit' ? (
        <div className="mt-3 flex flex-col gap-2" data-stock-request-edit>
          <input className={inputCls} value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-field="name" />
          <div className="flex gap-2 flex-wrap">
            <input className={`${inputCls} w-[130px]`} inputMode="numeric" value={draft.sum} onChange={(e) => setDraft({ ...draft, sum: e.target.value })} data-field="sum" />
            <input className={`${inputCls} w-[160px]`} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} data-field="date" />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            {VATS.map((v) => (
              <button key={v} type="button" className={pillCls(draft.vat === v)} onClick={() => setDraft({ ...draft, vat: v })} data-vat={v}>
                {VAT_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <select className={selectCls} value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value as CostPayment })} data-field="payment">
              {payments.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_LABELS[p]}
                </option>
              ))}
            </select>
            <select className={selectCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} data-field="category">
              {categories.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btnPinkCls} disabled={busy} onClick={() => void approve(true)} data-act="approve-edited">
              {busy ? '…' : isOwner ? 'Сохранить и одобрить' : 'Сохранить и передать владельцу'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setMode(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : mode === 'reject' ? (
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
            className={btnNeutralCls}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await rejectCostRequest(r.id, note.trim())
                return 'Запрос отклонён — затрата не создана.'
              })
            }
            data-act="reject"
          >
            Отклонить
          </button>
          <button type="button" className={btnNeutralCls} onClick={() => setMode(null)}>
            Отмена
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={btnPinkCls} disabled={busy} onClick={() => void approve(false)} data-act="approve">
            {busy ? '…' : isOwner ? 'Одобрить' : 'Одобрить → владельцу'}
          </button>
          <button type="button" className={btnNeutralCls} disabled={busy} onClick={() => setMode('edit')} data-act="edit">
            Изменить…
          </button>
          <button
            type="button"
            className={btnNeutralCls}
            disabled={busy}
            onClick={() => {
              setNote('')
              setMode('reject')
            }}
            data-act="reject-open"
          >
            Отклонить…
          </button>
        </div>
      )}
    </li>
  )
}

export function StockCostRequests({
  list,
  isOwner,
  categories,
  payments,
  onChanged,
}: {
  list: CostRequest[]
  isOwner: boolean
  categories: string[]
  payments: CostPayment[]
  onChanged: (message: string) => void
}) {
  if (!list.length) return null
  return (
    <section className={`${formCardCls} mb-3.5`} data-testid="stock-cost-requests">
      <h2 className={`${cardTitleCls} mb-1`}>Затраты со склада ({list.length})</h2>
      <p className={`${hintCls} mt-0 mb-3`}>
        {isOwner
          ? 'Администратор принял заказ и вписал сумму из чека. Затрата появится в месяце после вашего одобрения (управляющая одобряет первой, но вы можете и сразу).'
          : 'Администратор принял заказ и вписал сумму из чека. Проверьте сумму и чек — после вашего одобрения решает владелец.'}
      </p>
      <ul className="list-none m-0 p-0 flex flex-col gap-3">
        {list.map((r) => (
          <Item key={r.id} r={r} isOwner={isOwner} categories={categories} payments={payments} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  )
}
