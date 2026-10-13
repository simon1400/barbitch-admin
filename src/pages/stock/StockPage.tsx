// «Sklad — zásoby» (/stock, s251 — Фаза 1 плана STOCK_NEXT_SESSION_PROMPT.md): учёт
// расходников вместо Google-таблицы. owner, manager, administrator; чешский, под телефон.
//
// Вкладки (`?tab=`): Přehled — весь склад и три действия; Co objednat — что ниже минимума
// и сколько докупить, текст заказа; Deník — журнал движений; Nastavení — позиции
// (только руководство); Štítky — печать QR-ярлыков. Статусы, количества и «что заказать»
// считает сервер (fetch/stock.ts), цены администратору не приходят вовсе.
//
// Фаза 2 (s252): Objednávky — заказы (черновик → objednáno → přijato, приход с затратой или
// запросом на неё; `&order=<docId>` — раскрыть только что созданный); Inventura — понедельничная
// «Rychlá inventura». Кнопка «Upozornění» — подписка этого телефона на push (администраторам —
// инвентура, управляющей — «došlo» и сводка).
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errMsg } from '../../lib/errMsg'
import { btnNeutralCls, h1Cls, hintCls, iconBtnCls, kickerCls, pageShellCls, pillCls } from '../../ui/kit'
import { NotificationButton } from '../calendar/NotificationButton'
import { RefreshIcon } from '../upsell/components/icons'
import { fetchStock, type StockItem, type StockMeta } from './fetch/stock'
import OverviewTab from './tabs/OverviewTab'
import OrderTab from './tabs/OrderTab'
import OrdersTab from './tabs/OrdersTab'
import InventoryTab from './tabs/InventoryTab'
import LogTab from './tabs/LogTab'
import SettingsTab from './tabs/SettingsTab'
import LabelsTab from './tabs/LabelsTab'

type Tab = 'overview' | 'order' | 'orders' | 'inventory' | 'log' | 'settings' | 'labels'
const TABS: { key: Tab; label: string; edit?: boolean }[] = [
  { key: 'overview', label: 'Přehled' },
  { key: 'order', label: 'Co objednat' },
  { key: 'orders', label: 'Objednávky' },
  { key: 'inventory', label: 'Inventura' },
  { key: 'log', label: 'Deník' },
  { key: 'settings', label: 'Nastavení', edit: true },
  { key: 'labels', label: 'Štítky' },
]

export default function StockPage() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<StockItem[] | null>(null)
  const [meta, setMeta] = useState<StockMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // меняется после каждого сохранения — «Co objednat» и «Deník» перечитываются
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchStock()
      setItems(r.items)
      setMeta(r.meta)
      setReloadKey((k) => k + 1)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se načíst sklad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // сохранённая позиция заменяет свою строку; архивная — уходит из списка
  const onSaved = useCallback((item: StockItem) => {
    setItems((list) => {
      const rest = (list || []).filter((i) => i.documentId !== item.documentId)
      return item.active ? [...rest, item] : rest
    })
    setReloadKey((k) => k + 1)
  }, [])

  const raw = params.get('tab') as Tab | null
  const visible = TABS.filter((t) => !t.edit || meta?.canEdit)
  const tab: Tab = visible.some((t) => t.key === raw) ? (raw as Tab) : 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const inventoryLeft = (items || []).filter((i) => i.inventoryDue).length

  // порядок как у сервера: došlo → málo → место → название (после правки строки — тоже)
  const RANK = { out: 0, low: 1, ok: 2 }
  const sorted = (items || [])
    .slice()
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.location.localeCompare(b.location, 'cs') || a.name.localeCompare(b.name, 'cs'))

  return (
    <div className={pageShellCls}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className={kickerCls}>Zásoby a spotřební materiál</div>
          <h1 className={`${h1Cls} !mb-0`}>Sklad</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationButton popup="down-end" menuItem className={`${btnNeutralCls} inline-flex items-center !px-3`} />
          <button type="button" className={iconBtnCls} onClick={() => void load()} disabled={loading} aria-label="Obnovit" title="Obnovit">
            <RefreshIcon className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4" role="tablist">
        {visible.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={pillCls(tab === t.key)} onClick={() => setTab(t.key)} data-tab={t.key}>
            {t.label}
            {t.key === 'inventory' && inventoryLeft > 0 && ` ${inventoryLeft}`}
          </button>
        ))}
      </div>

      {error && <div className="text-[12.5px] font-semibold text-neg mb-3" data-error>{error}</div>}
      {!items || !meta ? (
        !error && <div className={hintCls}>Načítám…</div>
      ) : tab === 'order' ? (
        <OrderTab reloadKey={reloadKey} canEdit={meta.canEdit} onOrderCreated={(docId) => setParams({ tab: 'orders', order: docId }, { replace: true })} />
      ) : tab === 'orders' ? (
        <OrdersTab reloadKey={reloadKey} focus={params.get('order')} onChanged={() => void load()} />
      ) : tab === 'inventory' ? (
        <InventoryTab items={sorted} meta={meta} onSaved={onSaved} />
      ) : tab === 'log' ? (
        <LogTab reloadKey={reloadKey} />
      ) : tab === 'settings' ? (
        <SettingsTab items={sorted} meta={meta} onSaved={onSaved} editId={params.get('edit')} />
      ) : tab === 'labels' ? (
        <LabelsTab items={sorted} />
      ) : (
        <OverviewTab items={sorted} meta={meta} onSaved={onSaved} />
      )}
    </div>
  )
}
