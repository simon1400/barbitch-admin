// «Přijato» по заказу (s252, Фаза 2 плана STOCK_NEXT_SESSION_PROMPT.md): сколько упаковок пришло по
// строкам (по умолчанию — всё, что ещё ждём), «objednávka je kompletní», сумма из чека и фото чека.
//   • владелец / управляющая — затрата «Материалы» записывается сразу;
//   • администратор — уходит запрос на затрату (одобряют управляющая, потом владелец); сумму после
//     сохранения он не видит (сервер её не отдаёт);
//   • «Částku nevím» — приход без затраты, у руководства пометка «Náklad nezapsán».
// Остатки растут сразу при сохранении — это делает сервер (движение `in` с отметкой заказа).
import { useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { shrinkPhoto } from '../../../lib/shrinkPhoto'
import { btnNeutralCls, btnPinkCls, hintCls, inputCls, pillCls, selectCls } from '../../../ui/kit'
import {
  PAYMENT_LABEL,
  addReceiptCost,
  receiveStockOrder,
  uploadReceiptFile,
  type OrderPayment,
  type OrdersMeta,
  type ReceiptCostInput,
  type StockOrder,
} from '../fetch/stock'
import { packsText, smallCls } from '../stockText'

const VAT_LABEL: Record<number, string> = { 21: '21 %', 12: '12 %', 0: 'bez DPH' }

interface CostState {
  sum: string
  vat: number
  payment: OrderPayment
}

/** Сумма с DPH, ставка, оплата — общее для прихода и «Zapsat náklad». */
function CostFields({ value, onChange, meta }: { value: CostState; onChange: (v: CostState) => void; meta: OrdersMeta }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={hintCls}>Částka z dokladu (s DPH), Kč</span>
        <input
          className={`${inputCls} !text-[18px]`}
          inputMode="numeric"
          value={value.sum}
          onChange={(e) => onChange({ ...value, sum: e.target.value })}
          data-field="sum"
        />
      </label>
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className={hintCls}>DPH:</span>
        {meta.vats.map((v) => (
          <button key={v} type="button" className={pillCls(value.vat === v)} onClick={() => onChange({ ...value, vat: v })} data-vat={v}>
            {VAT_LABEL[v] ?? `${v} %`}
          </button>
        ))}
      </div>
      <select className={selectCls} value={value.payment} onChange={(e) => onChange({ ...value, payment: e.target.value as OrderPayment })} data-field="payment">
        {meta.payments.map((p) => (
          <option key={p} value={p}>
            {PAYMENT_LABEL[p]}
          </option>
        ))}
      </select>
    </div>
  )
}

const costBody = (c: CostState): ReceiptCostInput => ({ sum: c.sum.replace(/\s/g, ''), vat: c.vat, payment: c.payment })

interface ReceiveProps {
  order: StockOrder
  meta: OrdersMeta
  onDone: (order: StockOrder, message: string) => void
  onCancel: () => void
}

export function ReceiveForm({ order, meta, onDone, onCancel }: ReceiveProps) {
  const draft = order.status === 'draft'
  const [packs, setPacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.itemDocId, String(draft ? l.packs : l.remainingPacks)])),
  )
  const [complete, setComplete] = useState(false)
  const [withCost, setWithCost] = useState(true)
  const [cost, setCost] = useState<CostState>({ sum: '', vat: 21, payment: order.payment || 'card' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string | undefined) => (s && /^\d+$/.test(s.trim()) ? Number(s.trim()) : 0)
  // что-то останется недоставленным — спросить, закрыть ли заказ
  const leaves = order.lines.some((l) => num(packs[l.itemDocId]) < (draft ? l.packs : l.remainingPacks))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await receiveStockOrder(order.documentId, {
        lines: order.lines.map((l) => ({ itemDocId: l.itemDocId, packs: (packs[l.itemDocId] ?? '').trim() || 0 })),
        complete: leaves ? complete : true,
        cost: withCost ? costBody(cost) : null,
      })
      const notes: string[] = []
      if (res.failed.length) notes.push(`Nezapsáno na sklad: ${res.failed.join(', ')} — zadejte „Přišlo“ u položky.`)
      if (res.costError) notes.push(`Náklad se nezapsal: ${res.costError}`)
      if (file && withCost && !res.costError) {
        try {
          // фото с телефона ужимается, как у чеков затрат
          await uploadReceiptFile(order.documentId, res.receipt, await shrinkPhoto(file))
        } catch (e) {
          notes.push(`Doklad se nenahrál: ${errMsg(e, 'chyba')}`)
        }
      }
      const head = !withCost ? 'Přijato na sklad (bez nákladu).' : meta.canEdit ? 'Přijato na sklad, náklad zapsán.' : 'Přijato na sklad. Náklad čeká na schválení vedení.'
      onDone(res.order, [head, ...notes].join(' '))
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 border-t border-line-soft pt-3"
      data-receive-form={order.documentId}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className={hintCls}>Kolik balení přišlo (0 — nepřišlo):</div>
      {order.lines.map((l) => (
        <label key={l.itemDocId} className="flex items-center gap-3" data-receive-line={l.name}>
          <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">
            <b className="text-ink">{l.name}</b>
            <div className={smallCls}>
              objednáno {packsText(l.packs, l.packSize, l.unit)}
              {l.receivedPacks > 0 && ` · už přišlo ${l.receivedPacks}`}
            </div>
          </span>
          <input
            className={`${inputCls} w-[84px] text-center !text-[18px]`}
            inputMode="numeric"
            value={packs[l.itemDocId] ?? ''}
            onChange={(e) => setPacks((p) => ({ ...p, [l.itemDocId]: e.target.value }))}
            data-field="packs"
          />
        </label>
      ))}
      {leaves && (
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-body">
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} data-field="complete" />
          Zbytek nepřijde — objednávku uzavřít
        </label>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button type="button" className={pillCls(withCost)} onClick={() => setWithCost(true)} data-cost-mode="cost">
          Zapsat náklad
        </button>
        <button type="button" className={pillCls(!withCost)} onClick={() => setWithCost(false)} data-cost-mode="none">
          Částku nevím
        </button>
      </div>
      {withCost ? (
        <>
          <CostFields value={cost} onChange={setCost} meta={meta} />
          <label className="flex flex-col gap-1">
            <span className={hintCls}>Fotka dokladu (nepovinné)</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-field="file" />
          </label>
          {!meta.canEdit && <div className={hintCls}>Částku uvidí jen vedení salonu. Náklad schválí vedoucí a potom majitel.</div>}
        </>
      ) : (
        <div className={hintCls}>Zboží se přijme na sklad, náklad doplní vedení salonu.</div>
      )}

      {error && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="submit" className={`${btnPinkCls} flex-1`} disabled={busy} data-submit="receive">
          {busy ? '…' : 'Přijmout na sklad'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={busy}>
          Zpět
        </button>
      </div>
    </form>
  )
}

/** Руководство: затрата к приходу без неё (не знали сумму, запрос отклонили, запись упала). */
export function AddCostForm({ order, receipt, meta, onDone }: { order: StockOrder; receipt: number; meta: OrdersMeta; onDone: (order: StockOrder, message: string) => void }) {
  const [cost, setCost] = useState<CostState>({ sum: '', vat: 21, payment: order.payment || 'card' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-2 mt-2"
      data-add-cost={receipt}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const res = await addReceiptCost(order.documentId, receipt, costBody(cost))
          onDone(res.order, 'Náklad zapsán.')
        } catch (err) {
          setError(errMsg(err, 'Nepodařilo se uložit'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <CostFields value={cost} onChange={setCost} meta={meta} />
      {error && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error}
        </div>
      )}
      <button type="submit" className={`${btnPinkCls} self-start`} disabled={busy} data-submit="add-cost">
        {busy ? '…' : 'Zapsat náklad'}
      </button>
    </form>
  )
}
