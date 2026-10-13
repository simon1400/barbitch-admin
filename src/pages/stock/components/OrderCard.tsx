// Карточка заказа (s252): строки, статус, приходы с их затратой и действия по роли.
//   • черновик (руководство): правка строк/поставщика/срока, «Objednáno ✓», «Zrušit»;
//   • отправлен: «Přijato…» — все три роли; руководству ещё «Kopírovat» и «Uzavřít»;
//   • приход без затраты — руководству «Zapsat náklad».
// 🟥 Цен и сумм у администратора в ответе сервера нет — здесь они только показываются, если пришли.
import { useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { kc } from '../../../utils/money'
import {
  badgeFaintCls,
  badgeNegCls,
  badgeNeutralCls,
  badgePosCls,
  badgeWarnCls,
  btnDangerCls,
  btnNeutralCls,
  btnPinkCls,
  cardCls,
  cardTitleCls,
  hintCls,
  inputCls,
  selectCls,
} from '../../../ui/kit'
import {
  PAYMENT_LABEL,
  closeStockOrder,
  sendStockOrder,
  updateStockOrder,
  type OrderPayment,
  type OrdersMeta,
  type StockOrder,
} from '../fetch/stock'
import { COST_STATUS_TEXT, packsText, smallCls } from '../stockText'
import { AddCostForm, ReceiveForm } from './ReceiveForm'

const TONE = { pos: badgePosCls, warn: badgeWarnCls, neg: badgeNegCls, faint: badgeFaintCls }

const when = (iso: string | null) => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '—')

function StatusBadge({ order }: { order: StockOrder }) {
  if (order.status === 'sent') {
    const d = order.daysSinceSent ?? 0
    return order.overdue ? (
      <span className={badgeNegCls} data-order-status="overdue">
        Nepřišlo · {d} dní
      </span>
    ) : (
      <span className={badgeWarnCls} data-order-status="sent">
        Objednáno{d > 0 ? ` · před ${d} d.` : ' dnes'}
      </span>
    )
  }
  const cls = order.status === 'received' ? badgePosCls : order.status === 'draft' ? badgeNeutralCls : badgeFaintCls
  return (
    <span className={cls} data-order-status={order.status}>
      {order.statusLabel}
    </span>
  )
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Правка черновика / отправленного заказа без приходов. */
function OrderEditor({ order, meta, onSaved, onCancel }: { order: StockOrder; meta: OrdersMeta; onSaved: (o: StockOrder) => void; onCancel: () => void }) {
  const [supplier, setSupplier] = useState(order.supplier)
  const [expectedDays, setExpectedDays] = useState(String(order.expectedDays))
  const [payment, setPayment] = useState<OrderPayment | ''>(order.payment || '')
  const [note, setNote] = useState(order.note)
  const [lines, setLines] = useState(order.lines.map((l) => ({ ...l, packsText: String(l.packs), priceText: l.price == null ? '' : String(l.price).replace('.', ',') })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await updateStockOrder(order.documentId, {
        supplier,
        expectedDays,
        payment,
        note,
        lines: lines.map((l) => ({ itemDocId: l.itemDocId, packs: l.packsText.trim(), price: l.priceText.trim() === '' ? null : l.priceText.trim() })),
      })
      onSaved(res.order)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2.5 border-t border-line-soft pt-3" data-order-editor={order.documentId}>
      <input className={inputCls} placeholder="Dodavatel / obchod" value={supplier} onChange={(e) => setSupplier(e.target.value)} data-field="supplier" />
      {lines.map((l, i) => (
        <div key={l.itemDocId} className="flex items-center gap-2" data-edit-line={l.name}>
          <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">
            {l.name}
            <div className={smallCls}>{l.packSize > 1 ? `bal. à ${l.packSize} ${l.unit}` : l.unit}</div>
          </span>
          <input
            className={`${inputCls} w-[70px] text-center`}
            inputMode="numeric"
            value={l.packsText}
            onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, packsText: e.target.value } : x)))}
            data-field="packs"
            aria-label="Balení"
          />
          {meta.showPrices && (
            <input
              className={`${inputCls} w-[90px] text-right`}
              inputMode="decimal"
              placeholder="Kč/bal."
              value={l.priceText}
              onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, priceText: e.target.value } : x)))}
              data-field="price"
              aria-label="Cena balení"
            />
          )}
          {lines.length > 1 && (
            <button type="button" className={`${btnNeutralCls} !px-2.5`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Odebrat" data-remove-line>
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-body">
          Dodání do
          <input className={`${inputCls} w-[64px] text-center`} inputMode="numeric" value={expectedDays} onChange={(e) => setExpectedDays(e.target.value)} data-field="expectedDays" />
          dní
        </label>
        <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value as OrderPayment | '')} data-field="order-payment">
          <option value="">Platba — nevím</option>
          {meta.payments.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <input className={inputCls} placeholder="Poznámka (nepovinné)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} data-field="note" />
      {error && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className={btnPinkCls} disabled={busy} onClick={() => void save()} data-submit="order-edit">
          {busy ? '…' : 'Uložit'}
        </button>
        <button type="button" className={btnNeutralCls} disabled={busy} onClick={onCancel}>
          Zpět
        </button>
      </div>
    </div>
  )
}

type Mode = null | 'edit' | 'receive'

export function OrderCard({
  order,
  meta,
  onChanged,
  focused,
}: {
  order: StockOrder
  meta: OrdersMeta
  /** заказ изменился (ответ сервера) + что сказать */
  onChanged: (order: StockOrder, message: string) => void
  focused?: boolean
}) {
  const [mode, setMode] = useState<Mode>(focused && order.status === 'draft' && meta.canEdit ? 'edit' : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean | null>(null)
  const [costFor, setCostFor] = useState<number | null>(null)
  const open = order.status === 'draft' || order.status === 'sent'
  const canReceive = order.status === 'sent' || (order.status === 'draft' && meta.canEdit)

  const act = async (fn: () => Promise<{ order: StockOrder }>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      onChanged((await fn()).order, message)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`${cardCls} px-5 py-4 flex flex-col gap-2 ${order.overdue ? '!border-warn-line' : ''} ${focused ? 'ring-2 ring-brand-line' : ''}`}
      data-order={order.documentId}
      data-order-supplier={order.supplier || '-'}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className={`${cardTitleCls} flex-1 min-w-0`}>{order.supplier || 'Bez dodavatele'}</h2>
        <StatusBadge order={order} />
      </div>
      <div className={smallCls}>
        {order.sentAt ? `objednáno ${when(order.sentAt)}${order.sentBy ? ` · ${order.sentBy}` : ''}` : `založeno ${when(order.createdAt)}${order.createdBy ? ` · ${order.createdBy}` : ''}`}
        {order.payment && ` · ${PAYMENT_LABEL[order.payment]}`}
        {order.status === 'sent' && ` · dodání do ${order.expectedDays} dní`}
      </div>

      {mode !== 'edit' &&
        order.lines.map((l) => (
          <div key={l.itemDocId} className="flex items-start gap-3 py-1 border-t border-line-soft" data-order-line={l.name}>
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">
              <b className="text-ink">{l.name}</b> — {packsText(l.packs, l.packSize, l.unit)}
              {order.status !== 'draft' && l.receivedPacks > 0 && (
                <span className={`${smallCls} ml-1`} data-received={l.receivedPacks}>
                  · přišlo {l.receivedPacks}
                </span>
              )}
            </span>
            {l.sum != null && <span className={`${smallCls} shrink-0`}>{kc(l.sum)}</span>}
          </div>
        ))}
      {mode !== 'edit' && order.sum != null && (
        <div className="text-[13px] font-extrabold text-brand-dark" data-order-sum>
          ≈ {kc(order.sum)}
          {order.sumPartial && <span className={smallCls}> (bez cen u některých)</span>}
        </div>
      )}
      {order.note && <div className={hintCls}>„{order.note}“</div>}

      {order.receipts.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-2" data-receipts>
          {order.receipts.map((r) => {
            const st = COST_STATUS_TEXT[r.cost.status] ?? COST_STATUS_TEXT.none
            return (
              <div key={r.index} data-receipt={r.index}>
                <div className="flex items-center gap-2 flex-wrap text-[12.5px] font-semibold text-ink-body">
                  <span className="flex-1 min-w-0">
                    Přijato {when(r.at)} · {r.by}: {r.lines.map((l) => `${l.name} ${l.packs}×`).join(', ')}
                    {r.sum != null && ` · ${kc(r.sum)}`}
                  </span>
                  <span className={TONE[st.tone]} data-cost-status={r.cost.status}>
                    {st.label}
                  </span>
                </div>
                {meta.canEdit && r.needsCost && (
                  costFor === r.index ? (
                    <AddCostForm
                      order={order}
                      receipt={r.index}
                      meta={meta}
                      onDone={(o, m) => {
                        setCostFor(null)
                        onChanged(o, m)
                      }}
                    />
                  ) : (
                    <button type="button" className={`${btnNeutralCls} mt-1`} onClick={() => setCostFor(r.index)} data-act="add-cost">
                      Zapsat náklad
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {mode === 'edit' && (
        <OrderEditor
          order={order}
          meta={meta}
          onSaved={(o) => {
            setMode(null)
            onChanged(o, 'Objednávka uložena.')
          }}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'receive' && (
        <ReceiveForm
          order={order}
          meta={meta}
          onDone={(o, m) => {
            setMode(null)
            onChanged(o, m)
          }}
          onCancel={() => setMode(null)}
        />
      )}

      {error && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error}
        </div>
      )}
      {open && mode === null && (
        <div className="flex gap-2 flex-wrap">
          {canReceive && (
            <button type="button" className={order.status === 'sent' ? btnPinkCls : btnNeutralCls} onClick={() => setMode('receive')} data-act="receive">
              Přijato…
            </button>
          )}
          {meta.canEdit && order.status === 'draft' && (
            <button
              type="button"
              className={btnPinkCls}
              disabled={busy}
              onClick={() => void act(() => sendStockOrder(order.documentId), 'Označeno jako objednané.')}
              data-act="send"
            >
              Objednáno ✓
            </button>
          )}
          {meta.canEdit && (
            <button type="button" className={btnNeutralCls} onClick={async () => setCopied(await copyText(order.text))} data-act="copy">
              Kopírovat
            </button>
          )}
          {meta.canEdit && order.receipts.length === 0 && (
            <button type="button" className={btnNeutralCls} onClick={() => setMode('edit')} data-act="edit">
              Upravit
            </button>
          )}
          {meta.canEdit && (
            <button
              type="button"
              className={btnDangerCls}
              disabled={busy}
              onClick={() =>
                void act(
                  () => closeStockOrder(order.documentId),
                  order.receipts.length ? 'Objednávka uzavřena — zbytek nepřijde.' : 'Objednávka zrušena.',
                )
              }
              data-act="close"
            >
              {order.receipts.length ? 'Uzavřít' : 'Zrušit'}
            </button>
          )}
          {copied === true && <span className="self-center text-[12.5px] font-semibold text-pos">Zkopírováno</span>}
        </div>
      )}
      {copied === false && <textarea readOnly className="w-full min-h-[90px] text-[13px]" value={order.text} />}
    </section>
  )
}
