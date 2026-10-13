// «Přehled» (s251): весь склад — поиск, фильтры (статус, место, категория), строка
// раскрывается в три действия «Spočítat / Přišlo / Došlo». Порядок — с сервера:
// сначала došlo, потом málo, потом по месту и названию.
import { useMemo, useState } from 'react'

import { cardCls, hintCls, inputCls, pillCls, selectCls } from '../../../ui/kit'
import type { StockItem, StockMeta } from '../fetch/stock'
import { ItemRow } from '../components/StockParts'

type Filter = 'all' | 'out' | 'low' | 'due'

/** Поиск без регистра и диакритики: «kava» находит «Káva» (на телефоне háčky набирают редко). */
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Список позиций с одной раскрытой строкой. */
export function ItemList({ items, onSaved, hideLocation }: { items: StockItem[]; onSaved: (i: StockItem) => void; hideLocation?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className={`${cardCls} px-4 py-1.5`} data-item-list>
      {items.map((i) => (
        <ItemRow
          key={i.documentId}
          item={i}
          expanded={open === i.documentId}
          onToggle={() => setOpen(open === i.documentId ? null : i.documentId)}
          onSaved={onSaved}
          hideLocation={hideLocation}
        />
      ))}
    </div>
  )
}

export default function OverviewTab({ items, meta, onSaved }: { items: StockItem[]; meta: StockMeta; onSaved: (i: StockItem) => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loc, setLoc] = useState('')
  const [cat, setCat] = useState('')

  const counts = useMemo(
    () => ({
      out: items.filter((i) => i.status === 'out').length,
      low: items.filter((i) => i.status === 'low').length,
      due: items.filter((i) => i.countDue).length,
    }),
    [items],
  )
  const locations = useMemo(() => [...new Set(items.map((i) => i.location))].sort((a, b) => a.localeCompare(b, 'cs')), [items])
  const usedCats = useMemo(() => meta.categories.filter((c) => items.some((i) => i.category === c.key)), [items, meta])

  const shown = items.filter((i) => {
    if (filter === 'out' && i.status !== 'out') return false
    if (filter === 'low' && i.status !== 'low') return false
    if (filter === 'due' && !i.countDue) return false
    if (loc && i.location !== loc) return false
    if (cat && i.category !== cat) return false
    const s = fold(q.trim())
    return !s || fold(i.name).includes(s) || fold(i.location).includes(s)
  })

  if (!items.length) {
    return (
      <div className={`${cardCls} px-5 py-4 ${hintCls}`} data-empty>
        Sklad je zatím prázdný.{' '}
        {meta.canEdit ? 'Položky přidáte na kartě „Nastavení“.' : 'Položky zakládá vedení salonu.'}
      </div>
    )
  }

  const pill = (f: Filter, label: string, n?: number) => (
    <button type="button" className={pillCls(filter === f)} onClick={() => setFilter(f)} data-filter={f}>
      {label}
      {n != null && ` ${n}`}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        {pill('all', 'Vše', items.length)}
        {pill('out', 'Došlo', counts.out)}
        {pill('low', 'Málo', counts.low)}
        {pill('due', 'K přepočítání', counts.due)}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Hledat…" value={q} onChange={(e) => setQ(e.target.value)} data-search />
        {locations.length > 1 && (
          <select className={selectCls} value={loc} onChange={(e) => setLoc(e.target.value)} data-location-filter>
            <option value="">Všechna místa</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        {usedCats.length > 1 && (
          <select className={selectCls} value={cat} onChange={(e) => setCat(e.target.value)} data-category-filter>
            <option value="">Všechny kategorie</option>
            {usedCats.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {shown.length ? <ItemList items={shown} onSaved={onSaved} /> : <div className={hintCls}>Nic neodpovídá filtru.</div>}
    </div>
  )
}
