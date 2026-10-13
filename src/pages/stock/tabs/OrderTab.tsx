// «Co objednat» (s251, §3.3 плана): позиции ниже минимума, сколько докупить до «doplnit do»,
// группами по поставщику. Список и текст заказа строит сервер; «Kopírovat» кладёт текст
// в буфер (WhatsApp, e-mail, корзина магазина). Сумма — только руководству (сервер
// администратору её не отдаёт).
// Фаза 2 (s252): уже заказанное и не пришедшее сервер вычитает (`onOrderPacks`), полностью
// покрытое — отдельным списком «Už objednáno»; руководству — «Vytvořit objednávku» из группы
// (черновик с предложенным количеством и ценой упаковки → вкладка «Objednávky»).
import { useEffect, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { kc } from '../../../utils/money'
import { btnNeutralCls, btnPinkCls, cardCls, cardTitleCls, hintCls } from '../../../ui/kit'
import { createStockOrder, fetchStockOrder, type CoveredItem, type OrderGroup } from '../fetch/stock'
import { StatusChip } from '../components/StockParts'
import { packsText, smallCls } from '../stockText'

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function Covered({ list }: { list: CoveredItem[] }) {
  if (!list.length) return null
  return (
    <section className={`${cardCls} px-5 py-3`} data-covered>
      <h2 className={`${cardTitleCls} mb-1`}>Už objednáno — čeká se na dodání</h2>
      {list.map((c) => (
        <div key={c.documentId} className="flex items-center gap-3 py-1 text-[13px] font-semibold text-ink-body" data-covered-item={c.name}>
          <span className="min-w-0 flex-1 break-words">
            <b className="text-ink">{c.name}</b> — objednáno {packsText(c.onOrderPacks, c.packSize, c.unit)}
            <div className={smallCls}>
              {c.location} · teď {c.qtyText}
            </div>
          </span>
          <StatusChip status={c.status} />
        </div>
      ))}
    </section>
  )
}

/** `reloadKey` меняется после каждого движения — список пересобирается. */
export default function OrderTab({ reloadKey, canEdit, onOrderCreated }: { reloadKey: number; canEdit: boolean; onOrderCreated: (docId: string) => void }) {
  const [groups, setGroups] = useState<OrderGroup[] | null>(null)
  const [covered, setCovered] = useState<CoveredItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    fetchStockOrder()
      .then((r) => {
        if (!alive) return
        setGroups(r.groups)
        setCovered(r.covered || [])
      })
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst')))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const copy = async (key: string, text: string) => {
    setCopied((await copyText(text)) ? key : `!${key}`)
  }

  /** Черновик заказа из группы: предложенные упаковки и последняя цена упаковки. */
  const create = async (g: OrderGroup) => {
    setCreating(g.supplier)
    setCreateError(null)
    try {
      const { order } = await createStockOrder({
        supplier: g.supplier,
        lines: g.lines.map((l) => ({ itemDocId: l.documentId, packs: l.packs, price: l.price ?? null })),
      })
      onOrderCreated(order.documentId)
    } catch (e) {
      setCreateError(errMsg(e, 'Nepodařilo se založit objednávku'))
      setCreating(null)
    }
  }

  if (error) return <div className="text-[12.5px] font-semibold text-neg">{error}</div>
  if (!groups) return <div className={hintCls}>Načítám…</div>
  if (!groups.length) {
    return (
      <div className="flex flex-col gap-3.5">
        <div className={`${cardCls} px-5 py-4 text-[13px] font-semibold text-pos`} data-order-empty>
          ✓ {covered.length ? 'Vše pod minimem už je objednané.' : 'Nic není pod minimem — není co objednat.'}
        </div>
        <Covered list={covered} />
      </div>
    )
  }

  const all = groups.map((g) => g.text).join('\n\n')
  return (
    <div className="flex flex-col gap-3.5">
      {createError && <div className="text-[12.5px] font-semibold text-neg" data-error>{createError}</div>}
      {groups.length > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={btnNeutralCls} onClick={() => void copy('*', all)} data-copy="*">
            Kopírovat vše
          </button>
          {copied === '*' && <span className="text-[12.5px] font-semibold text-pos">Zkopírováno</span>}
        </div>
      )}
      {groups.map((g) => (
        <section key={g.supplier || '-'} className={`${cardCls} px-5 py-4 flex flex-col gap-2`} data-order-group={g.supplier || '-'}>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`${cardTitleCls} flex-1 min-w-0`}>{g.supplier || 'Bez dodavatele'}</h2>
            {g.sum != null && (
              <span className="text-[13px] font-extrabold text-brand-dark" data-order-sum>
                ≈ {kc(g.sum)}
                {g.sumPartial && <span className={smallCls}> (bez cen u některých)</span>}
              </span>
            )}
          </div>
          {g.lines.map((l) => (
            <div key={l.documentId} className="flex items-start gap-3 py-1.5 border-t border-line-soft first:border-t-0" data-order-line={l.name}>
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">
                <b className="text-ink">{l.name}</b> — {l.packSize > 1 ? `${l.packs} bal. (à ${l.packSize} ${l.unit})` : `${l.packs} ${l.unit}`}
                <div className={smallCls}>
                  {l.location} · teď {l.qtyText}
                  {l.onOrderPacks > 0 && ` · už objednáno ${l.onOrderPacks}`}
                  {l.url && (
                    <>
                      {' · '}
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand-dark hover:underline">
                        odkaz
                      </a>
                    </>
                  )}
                </div>
              </span>
              <span className="shrink-0 flex flex-col items-end gap-1">
                <StatusChip status={l.status} />
                {l.sum != null && <span className={smallCls}>{kc(l.sum)}</span>}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button type="button" className={btnPinkCls} disabled={creating != null} onClick={() => void create(g)} data-create-order={g.supplier || '-'}>
                {creating === g.supplier ? '…' : 'Vytvořit objednávku'}
              </button>
            )}
            <button type="button" className={btnNeutralCls} onClick={() => void copy(g.supplier, g.text)} data-copy={g.supplier || '-'}>
              Kopírovat objednávku
            </button>
            {copied === g.supplier && <span className="text-[12.5px] font-semibold text-pos">Zkopírováno</span>}
            {copied === `!${g.supplier}` && <span className="text-[12.5px] font-semibold text-neg">Kopírování nejde — označte text níže</span>}
          </div>
          {copied === `!${g.supplier}` && <textarea readOnly className="w-full min-h-[90px] text-[13px]" value={g.text} />}
        </section>
      ))}
      <Covered list={covered} />
      <div className={hintCls}>
        Množství = doplnit do „doplnit do“ (nebo do dvojnásobku minima), minus co už je objednané.
        {canEdit ? ' „Vytvořit objednávku“ ji založí na kartě „Objednávky“ — tam upravíte počty a označíte „Objednáno“.' : ' Objednává vedení salonu.'}
      </div>
    </div>
  )
}
