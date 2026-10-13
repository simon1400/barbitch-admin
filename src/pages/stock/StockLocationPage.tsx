// Позиции одного места (/stock/l/:slug, s251) — сюда ведёт QR-ярлык полки: подошёл к шкафу,
// отсканировал, прошёл по списку «Spočítat» (понедельничная инвентура). Код места
// (`locationSlug`) считает сервер; место переименовали — ярлык перепечатать.
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { errMsg } from '../../lib/errMsg'
import { h1Cls, hintCls, kickerCls, pageShellCls } from '../../ui/kit'
import { fetchStock, type StockItem } from './fetch/stock'
import { ItemList } from './tabs/OverviewTab'

export default function StockLocationPage() {
  const { slug = '' } = useParams()
  const [items, setItems] = useState<StockItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await fetchStock()
      setItems(r.items.filter((i) => i.locationSlug === slug).sort((a, b) => a.name.localeCompare(b.name, 'cs')))
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se načíst sklad'))
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const onSaved = (item: StockItem) => setItems((list) => (list || []).map((i) => (i.documentId === item.documentId ? item : i)))
  const due = items?.filter((i) => i.countDue).length ?? 0

  return (
    <div className={`${pageShellCls} !max-w-[560px]`}>
      <Link to="/stock" className="text-[12.5px] font-bold text-brand-dark hover:underline">
        ← Celý sklad
      </Link>
      <div className={`${kickerCls} mt-3`}>Místo</div>
      <h1 className={h1Cls}>📍 {items?.[0]?.location ?? slug}</h1>
      {error && <div className="text-[13px] font-semibold text-neg" data-error>{error}</div>}
      {!items && !error && <div className={hintCls}>Načítám…</div>}
      {items && !items.length && <div className={hintCls} data-empty>Na tomto místě nejsou žádné položky (možná bylo místo přejmenováno — vytiskněte nový štítek).</div>}
      {items && items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className={hintCls}>
            {items.length} položek{due > 0 && ` · ${due} k přepočítání`}. Klepněte na položku → „Spočítat“.
          </div>
          <ItemList items={items} onSaved={onSaved} hideLocation />
        </div>
      )}
    </div>
  )
}
