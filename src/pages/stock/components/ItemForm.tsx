// Форма позиции склада (s251) — только руководство. Создание: всё + «сколько сейчас»
// (стартовый остаток — он же первый пересчёт); правка: настройки, остаток не меняется
// (для этого «Spočítat»). Шлются только изменённые поля. Названия, места и поставщики —
// автодополнение с сервера (свои позиции + старая коллекция «Склад» + места по умолчанию).
import { useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls, selectCls } from '../../../ui/kit'
import {
  createStockItem,
  updateStockItem,
  type StockItem,
  type StockItemInput,
  type StockMeta,
  type StockSuggest,
  type StockUnit,
} from '../fetch/stock'

interface Props {
  meta: StockMeta
  suggest: StockSuggest | null
  /** null — новая позиция */
  item: StockItem | null
  onSaved: (item: StockItem) => void
  onCancel: () => void
}

type Draft = Record<
  'name' | 'category' | 'location' | 'unit' | 'packSize' | 'min' | 'target' | 'supplier' | 'url' | 'lastPrice' | 'countEveryDays' | 'note' | 'packs' | 'units',
  string
>

const draftOf = (item: StockItem | null): Draft => ({
  name: item?.name ?? '',
  category: item?.category ?? 'hygiena',
  location: item?.location ?? '',
  unit: item?.unit ?? 'ks',
  packSize: String(item?.packSize ?? 1),
  min: String(item?.min ?? ''),
  target: item?.target ? String(item.target) : '',
  supplier: item?.supplier ?? '',
  url: item?.url ?? '',
  lastPrice: item?.lastPrice != null ? String(item.lastPrice) : '',
  countEveryDays: String(item?.countEveryDays ?? 7),
  note: item?.note ?? '',
  packs: '',
  units: '',
})

/** Поля для сервера: при правке — только изменённые. */
const itemPayload = (draft: Draft, item: StockItem | null, showPrices: boolean): StockItemInput => {
  const base = draftOf(item)
  const keys = ['name', 'category', 'location', 'unit', 'packSize', 'min', 'target', 'supplier', 'url', 'countEveryDays', 'note'] as const
  const out: StockItemInput = {}
  for (const k of keys) if (!item || draft[k].trim() !== base[k].trim()) (out as Record<string, string>)[k] = draft[k].trim()
  if (showPrices && (!item || draft.lastPrice.trim() !== base.lastPrice.trim())) out.lastPrice = draft.lastPrice.trim() === '' ? null : draft.lastPrice.trim()
  if (!item) {
    if (Number(draft.packSize) > 1 && draft.packs.trim() !== '') out.packs = draft.packs.trim()
    if (draft.units.trim() !== '') out.units = draft.units.trim()
  }
  return out
}

const fieldCls = 'flex flex-col min-w-0'

export function ItemForm({ meta, suggest, item, onSaved, onCancel }: Props) {
  const [d, setD] = useState<Draft>(() => draftOf(item))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const withPacks = Number(d.packSize) > 1
  const unitLabel = d.unit as StockUnit

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = itemPayload(d, item, meta.showPrices)
      if (item && !Object.keys(body).length) {
        onCancel()
        return
      }
      const res = item ? await updateStockItem(item.documentId, body) : await createStockItem(body)
      onSaved(res.item)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    if (!item) return
    setBusy(true)
    setError(null)
    try {
      onSaved((await updateStockItem(item.documentId, { active: !item.active })).item)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      data-item-form={item?.documentId || 'new'}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <datalist id="stock-names">{suggest?.names.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="stock-locations">{suggest?.locations.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="stock-suppliers">{suggest?.suppliers.map((n) => <option key={n} value={n} />)}</datalist>

      <label className={fieldCls}>
        <span className={labelCls}>Název *</span>
        <input className={inputCls} list="stock-names" value={d.name} onChange={set('name')} maxLength={120} required data-field="name" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldCls}>
          <span className={labelCls}>Kategorie</span>
          <select className={selectCls} value={d.category} onChange={set('category')} data-field="category">
            {meta.categories
              .filter((c) => !c.later || c.key === d.category)
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
          </select>
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>Umístění *</span>
          <input className={inputCls} list="stock-locations" value={d.location} onChange={set('location')} maxLength={80} required data-field="location" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldCls}>
          <span className={labelCls}>Jednotka</span>
          <select className={selectCls} value={d.unit} onChange={set('unit')} data-field="unit">
            {meta.units.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>V balení ({unitLabel})</span>
          <input className={inputCls} inputMode="numeric" value={d.packSize} onChange={set('packSize')} data-field="packSize" />
        </label>
      </div>
      <div className={hintCls}>
        {withPacks
          ? `Minimum a „doplnit do“ jsou v baleních (1 bal. = ${d.packSize} ${unitLabel}).`
          : `Kupuje se po kusech — minimum a „doplnit do“ jsou v ${unitLabel}. Pokud se kupuje v balení, vyplňte „V balení“.`}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={fieldCls}>
          <span className={labelCls}>Minimum</span>
          <input className={inputCls} inputMode="numeric" value={d.min} onChange={set('min')} placeholder="0" data-field="min" />
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>Doplnit do</span>
          <input className={inputCls} inputMode="numeric" value={d.target} onChange={set('target')} placeholder="2× min" data-field="target" />
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>Počítat (dní)</span>
          <input className={inputCls} inputMode="numeric" value={d.countEveryDays} onChange={set('countEveryDays')} data-field="countEveryDays" />
        </label>
      </div>
      <div className={meta.showPrices ? 'grid grid-cols-2 gap-3' : ''}>
        <label className={fieldCls}>
          <span className={labelCls}>Dodavatel / obchod</span>
          <input className={inputCls} list="stock-suppliers" value={d.supplier} onChange={set('supplier')} maxLength={80} data-field="supplier" />
        </label>
        {meta.showPrices && (
          <label className={fieldCls}>
            <span className={labelCls}>Cena balení (Kč)</span>
            <input className={inputCls} inputMode="decimal" value={d.lastPrice} onChange={set('lastPrice')} data-field="lastPrice" />
          </label>
        )}
      </div>
      <label className={fieldCls}>
        <span className={labelCls}>Odkaz (kde koupit)</span>
        <input className={inputCls} type="url" value={d.url} onChange={set('url')} maxLength={500} placeholder="https://…" data-field="url" />
      </label>
      <label className={fieldCls}>
        <span className={labelCls}>Poznámka</span>
        <textarea className={`${inputCls} min-h-[60px]`} value={d.note} onChange={set('note')} maxLength={500} data-field="note" />
      </label>
      {!item && (
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Kolik je teď na skladě</span>
          <div className="flex gap-2 items-end">
            {withPacks && (
              <label className="flex-1 min-w-0">
                <span className={hintCls}>balení</span>
                <input className={inputCls} inputMode="numeric" value={d.packs} onChange={set('packs')} data-field="packs" />
              </label>
            )}
            <label className="flex-1 min-w-0">
              <span className={hintCls}>{withPacks ? `+ ${unitLabel} navíc` : unitLabel}</span>
              <input className={inputCls} inputMode={d.unit === 'ks' ? 'numeric' : 'decimal'} value={d.units} onChange={set('units')} data-field="units" />
            </label>
          </div>
          <div className={hintCls}>Nevyplněno = 0 a položka čeká na první spočítání.</div>
        </div>
      )}

      {error && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="submit" className={btnPinkCls} disabled={busy} data-save>
          {item ? 'Uložit' : 'Přidat položku'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={busy}>
          Zrušit
        </button>
        {item && (
          <button type="button" className={`${btnNeutralCls} ml-auto`} onClick={() => void toggleActive()} disabled={busy} data-toggle-active>
            {item.active ? 'Archivovat' : 'Obnovit'}
          </button>
        )}
      </div>
    </form>
  )
}
