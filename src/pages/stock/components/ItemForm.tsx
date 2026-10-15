// Форма позиции склада (s251; s257 — и администраторы, поле цены только руководству). Создание: всё + «сколько сейчас»
// (стартовый остаток — он же первый пересчёт); правка: настройки, остаток не меняется
// (для этого «Spočítat»). Шлются только изменённые поля. Названия, места и поставщики —
// автодополнение с сервера (свои позиции + старая коллекция «Склад» + места по умолчанию).
// s258 (администратор вводил «0,2 канистры»): ошибка сервера — под своим полем (`stockErrorField`),
// у ml/g упаковки дробные с подсказкой «0,2 bal. = 1000 ml», минимум и «doplnit do» у них тоже дробные (0,2 канистры).
// s261 (Фаза 3): при правке — подсказка минимума по расходу («Použít» подставляет, сохраняет человек).
import { useState } from 'react'

import { btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls, selectCls } from '../../../ui/kit'
import {
  createStockItem,
  packsHint,
  stockErrorField,
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
const fieldErrCls = 'text-[12.5px] font-semibold text-neg mt-1'

/**
 * s261: подсказка минимума по расходу. «Doplnit do» должно быть больше минимума (сервер: `target_below_min`) —
 * если подсказка его догоняет, «Použít» очищает его: пустое = 2× minimum.
 */
function MinHint({ suggested, useText, unit, target, onUse }: { suggested: number; useText: string; unit: string; target: string; onUse: (min: string, target: string) => void }) {
  const t = Number(target.trim().replace(',', '.'))
  const clash = target.trim() !== '' && Number.isFinite(t) && t <= suggested
  return (
    <div className={`${hintCls} flex items-center gap-2 flex-wrap`} data-min-hint>
      <span>
        Podle spotřeby ({useText}) doporučuji minimum {String(suggested).replace('.', ',')} {unit} — vystačí na dodání a týden navíc.
        {clash && ' „Doplnit do“ se vyprázdní (= 2× minimum).'}
      </span>
      <button type="button" className={`${btnNeutralCls} !py-1 !px-2.5`} onClick={() => onUse(String(suggested), clash ? '' : target)} data-use-min>
        Použít
      </button>
    </div>
  )
}

export function ItemForm({ meta, suggest, item, onSaved, onCancel }: Props) {
  const [d, setD] = useState<Draft>(() => draftOf(item))
  const [busy, setBusy] = useState(false)
  // ошибка сервера: [поле формы | null, текст] — под полем или общей строкой внизу
  const [error, setError] = useState<[string | null, string] | null>(null)
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const withPacks = Number(d.packSize) > 1
  const unitLabel = d.unit as StockUnit
  const pieces = d.unit === 'ks'
  const fieldErr = (k: string) =>
    error && error[0] === k ? (
      <span className={fieldErrCls} data-field-error={k}>
        {error[1]}
      </span>
    ) : null

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
      setError(stockErrorField(e))
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
      setError(stockErrorField(e))
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
        {fieldErr('name')}
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
          {fieldErr('location')}
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
          {fieldErr('packSize')}
        </label>
      </div>
      <div className={hintCls}>
        {withPacks
          ? `Minimum a „doplnit do“ jsou v baleních (1 bal. = ${d.packSize} ${unitLabel})${pieces ? ', celá čísla.' : `, i desetinná. Příklad: kanystr 5 l → jednotka ml, v balení 5000, minimum 0,2 (= ${Math.round(Number(d.packSize) * 0.2 * 100) / 100} ${unitLabel}).`}`
          : `Kupuje se po kusech — minimum a „doplnit do“ jsou v ${unitLabel}. Pokud se kupuje v balení, vyplňte „V balení“.`}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={fieldCls}>
          <span className={labelCls}>Minimum{withPacks ? ' (bal.)' : ''}</span>
          <input className={inputCls} inputMode={pieces ? 'numeric' : 'decimal'} value={d.min} onChange={set('min')} placeholder="0" data-field="min" />
          {fieldErr('min')}
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>Doplnit do{withPacks ? ' (bal.)' : ''}</span>
          <input className={inputCls} inputMode={pieces ? 'numeric' : 'decimal'} value={d.target} onChange={set('target')} placeholder="2× min" data-field="target" />
          {fieldErr('target')}
        </label>
        <label className={fieldCls}>
          <span className={labelCls}>Počítat (dní)</span>
          <input className={inputCls} inputMode="numeric" value={d.countEveryDays} onChange={set('countEveryDays')} data-field="countEveryDays" />
          {fieldErr('countEveryDays')}
        </label>
      </div>
      {item?.suggestedMin != null && String(item.suggestedMin) !== d.min.trim().replace(',', '.') && (
        <MinHint
          suggested={item.suggestedMin}
          useText={item.useText ?? ''}
          unit={withPacks ? 'bal.' : unitLabel}
          target={d.target}
          onUse={(min, target) => setD((x) => ({ ...x, min, target }))}
        />
      )}
      <div className={meta.showPrices ? 'grid grid-cols-2 gap-3' : ''}>
        <label className={fieldCls}>
          <span className={labelCls}>Dodavatel / obchod</span>
          <input className={inputCls} list="stock-suppliers" value={d.supplier} onChange={set('supplier')} maxLength={80} data-field="supplier" />
          {fieldErr('supplier')}
        </label>
        {meta.showPrices && (
          <label className={fieldCls}>
            <span className={labelCls}>Cena balení (Kč)</span>
            <input className={inputCls} inputMode="decimal" value={d.lastPrice} onChange={set('lastPrice')} data-field="lastPrice" />
            {fieldErr('lastPrice')}
          </label>
        )}
      </div>
      <label className={fieldCls}>
        <span className={labelCls}>Odkaz (kde koupit)</span>
        <input className={inputCls} type="url" value={d.url} onChange={set('url')} maxLength={500} placeholder="https://…" data-field="url" />
        {fieldErr('url')}
      </label>
      <label className={fieldCls}>
        <span className={labelCls}>Poznámka</span>
        <textarea className={`${inputCls} min-h-[60px]`} value={d.note} onChange={set('note')} maxLength={500} data-field="note" />
        {fieldErr('note')}
      </label>
      {!item && (
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Kolik je teď na skladě</span>
          <div className="flex gap-2 items-end">
            {withPacks && (
              <label className="flex-1 min-w-0 flex flex-col">
                <span className={hintCls}>{pieces ? 'balení (celá)' : 'balení (i desetinné)'}</span>
                <input className={inputCls} inputMode={pieces ? 'numeric' : 'decimal'} value={d.packs} onChange={set('packs')} data-field="packs" />
                {fieldErr('packs')}
              </label>
            )}
            <label className="flex-1 min-w-0 flex flex-col">
              <span className={hintCls}>{withPacks ? `+ ${unitLabel} navíc` : unitLabel}</span>
              <input className={inputCls} inputMode={pieces ? 'numeric' : 'decimal'} value={d.units} onChange={set('units')} data-field="units" />
              {fieldErr('units')}
            </label>
          </div>
          <div className={hintCls} data-packs-hint>
            {packsHint(d.packs, Number(d.packSize), unitLabel) ??
              (withPacks && !pieces ? `Např. 0,2 bal. = ${Math.round(Number(d.packSize) * 0.2 * 100) / 100} ${unitLabel}. ` : '')}
            Nevyplněno = 0 a položka čeká na první spočítání.
          </div>
        </div>
      )}

      {error && error[0] === null && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error[1]}
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
