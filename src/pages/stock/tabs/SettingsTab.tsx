// «Nastavení» (s251; s257 — все три роли, цену видит и задаёт только руководство): новая позиция, правка настроек (место, минимум,
// «doplnit do», поставщик, цена, ритм пересчёта), архив. Остаток здесь не меняется —
// для этого «Spočítat». Автодополнение грузится один раз, при первом открытии формы.
import { useEffect, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { kc } from '../../../utils/money'
import { btnPinkCls, cardCls, chipCls, hintCls } from '../../../ui/kit'
import { fetchStock, fetchStockSuggest, type StockItem, type StockMeta, type StockSuggest } from '../fetch/stock'
import { ItemForm } from '../components/ItemForm'
import { smallCls } from '../stockText'

interface Props {
  items: StockItem[]
  meta: StockMeta
  onSaved: (item: StockItem) => void
  /** открыть форму этой позиции сразу (`?tab=settings&edit=…`) */
  editId?: string | null
}

export default function SettingsTab({ items, meta, onSaved, editId }: Props) {
  const [editing, setEditing] = useState<string | null>(editId || null)
  const [suggest, setSuggest] = useState<StockSuggest | null>(null)
  const [archived, setArchived] = useState<StockItem[] | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing || suggest) return
    let alive = true
    fetchStockSuggest()
      .then((s) => alive && setSuggest(s))
      .catch(() => alive && setSuggest({ names: [], locations: [], suppliers: [] }))
    return () => {
      alive = false
    }
  }, [editing, suggest])

  useEffect(() => {
    if (!showArchived) return
    let alive = true
    fetchStock(true)
      .then((r) => alive && setArchived(r.items.filter((i) => !i.active)))
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst archiv')))
    return () => {
      alive = false
    }
  }, [showArchived, items])

  const saved = (item: StockItem) => {
    setEditing(null)
    onSaved(item)
  }

  const list = showArchived ? (archived ?? []) : [...items].sort((a, b) => a.location.localeCompare(b.location, 'cs') || a.name.localeCompare(b.name, 'cs'))
  const catLabel = (key: string) => meta.categories.find((c) => c.key === key)?.label ?? key

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnPinkCls} onClick={() => setEditing('new')} disabled={editing === 'new'} data-new-item>
          + Nová položka
        </button>
        <button type="button" className={`${chipCls(showArchived)} ml-auto`} onClick={() => setShowArchived((v) => !v)} data-show-archived>
          Archiv
        </button>
      </div>
      {editing === 'new' && (
        <div className={`${cardCls} px-5 py-4`}>
          <ItemForm meta={meta} suggest={suggest} item={null} onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}
      {error && <div className="text-[12.5px] font-semibold text-neg">{error}</div>}
      {showArchived && archived && !archived.length && <div className={hintCls}>Archiv je prázdný.</div>}
      {!showArchived && !items.length && editing !== 'new' && <div className={hintCls}>Zatím žádné položky — začněte „Nová položka“.</div>}
      {list.length > 0 && (
        <div className={`${cardCls} px-4 py-1.5`} data-settings-list>
          {list.map((i) => (
            <div key={i.documentId} className="py-2.5 border-t border-line-soft first:border-t-0" data-settings-item={i.name}>
              {editing === i.documentId ? (
                <ItemForm meta={meta} suggest={suggest} item={i} onSaved={saved} onCancel={() => setEditing(null)} />
              ) : (
                <button type="button" className="w-full flex items-start gap-3 text-left bg-transparent border-0 p-0 cursor-pointer" onClick={() => setEditing(i.documentId)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink break-words">{i.name}</span>
                    <span className={smallCls}>
                      {i.location} · {catLabel(i.category)}
                      {i.supplier && ` · ${i.supplier}`}
                    </span>
                  </span>
                  <span className={`${smallCls} shrink-0 text-right`}>
                    min {i.minText} · do {`${String(i.effectiveTarget).replace('.', ',')} ${i.packSize > 1 ? 'bal.' : i.unit}`}
                    <br />
                    {i.packSize > 1 && `bal. = ${i.packSize} ${i.unit}`}
                    {meta.showPrices && i.lastPrice != null && ` · ${kc(i.lastPrice)}`}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
