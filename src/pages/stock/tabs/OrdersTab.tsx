// «Objednávky» (s252, Фаза 2): заказы склада. Руководству — черновики, отправленные и закрытые
// за 60 дней; администратору — отправленные (их принимать) и принятые за 14 дней, без цен.
// `focus` — заказ, который только что создали из «Co objednat» (раскрыт на правку).
import { useEffect, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { cardCls, hintCls } from '../../../ui/kit'
import { fetchStockOrders, type OrdersMeta, type StockOrder } from '../fetch/stock'
import { OrderCard } from '../components/OrderCard'

export default function OrdersTab({ reloadKey, focus, onChanged }: { reloadKey: number; focus: string | null; onChanged: () => void }) {
  const [orders, setOrders] = useState<StockOrder[] | null>(null)
  const [meta, setMeta] = useState<OrdersMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    fetchStockOrders()
      .then((r) => {
        if (!alive) return
        setOrders(r.orders)
        setMeta(r.meta)
      })
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst')))
    return () => {
      alive = false
    }
  }, [reloadKey])

  if (error) return <div className="text-[12.5px] font-semibold text-neg">{error}</div>
  if (!orders || !meta) return <div className={hintCls}>Načítám…</div>

  const changed = (o: StockOrder, msg: string) => {
    setOrders((list) => (list || []).map((x) => (x.documentId === o.documentId ? o : x)))
    setMessage(msg)
    // остатки и «Co objednat» изменились — странице перечитать
    onChanged()
  }

  const groups: { key: string; title: string; list: StockOrder[] }[] = [
    { key: 'sent', title: 'Čeká na dodání', list: orders.filter((o) => o.status === 'sent') },
    { key: 'draft', title: 'Rozpracované', list: orders.filter((o) => o.status === 'draft') },
    { key: 'closed', title: 'Uzavřené', list: orders.filter((o) => o.status === 'received' || o.status === 'cancelled') },
  ]

  return (
    <div className="flex flex-col gap-3.5" data-orders>
      {message && (
        <div className="text-[12.5px] font-semibold text-pos" data-message>
          ✓ {message}
        </div>
      )}
      {!orders.length && (
        <div className={`${cardCls} px-5 py-4 ${hintCls}`} data-orders-empty>
          {meta.canEdit
            ? 'Zatím žádné objednávky. Založíte je na kartě „Co objednat“ — tlačítkem „Vytvořit objednávku“.'
            : 'Žádná objednávka teď nečeká na dodání.'}
        </div>
      )}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <div key={g.key} className="flex flex-col gap-2.5" data-order-group-status={g.key}>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-ink-label">
              {g.title} ({g.list.length})
            </div>
            {g.list.map((o) => (
              <OrderCard key={o.documentId} order={o} meta={meta} onChanged={changed} focused={o.documentId === focus} />
            ))}
          </div>
        ))}
      {!meta.canEdit && orders.some((o) => o.status === 'sent') && (
        <div className={hintCls}>Když zboží přijde: „Přijato…“, zkontrolujte počty a opište částku z dokladu (uvidí ji jen vedení).</div>
      )}
    </div>
  )
}
