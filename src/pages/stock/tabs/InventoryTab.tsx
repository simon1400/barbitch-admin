// «Inventura» (s252, Фаза 2, решение владельца §0.6): еженедельная «Rychlá inventura» по понедельникам.
// Список — позиции, которые с понедельника не пересчитаны и чей срок (`countEveryDays`) наступает на
// этой неделе (считает сервер — `inventoryDue`). По местам, чтобы идти от полки к полке. На строку —
// «✓ Sedí» (тот же остаток, одним тапом) или «Jinak…» (ввести, сколько есть). Посчитанная уходит из списка.
import { useMemo, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { fmtCsDate, mondayOfYmd } from '../../../utils/date'
import { btnNeutralCls, btnPinkCls, cardCls, cardTitleCls, hintCls, inputCls } from '../../../ui/kit'
import { postStockMove, splitQty, type MoveInput, type StockItem, type StockMeta } from '../fetch/stock'
import { smallCls } from '../stockText'

function InventoryRow({ item, onSaved }: { item: StockItem; onSaved: (i: StockItem) => void }) {
  const withPacks = item.packSize > 1
  const [open, setOpen] = useState(false)
  const [packs, setPacks] = useState('')
  const [units, setUnits] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (body: MoveInput) => {
    setBusy(true)
    setError(null)
    try {
      onSaved((await postStockMove(item.documentId, body)).item)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se uložit'))
      setBusy(false)
    }
  }
  const same = () => {
    const s = splitQty(item.qty, item.packSize)
    void send({ kind: 'count', ...(withPacks ? { packs: s.packs } : {}), units: s.units })
  }
  const other = () =>
    void send({
      kind: 'count',
      ...(withPacks && packs.trim() !== '' ? { packs: packs.trim() } : {}),
      ...(units.trim() !== '' ? { units: units.trim() } : {}),
    })

  return (
    <div className="py-2.5 border-t border-line-soft first:border-t-0" data-inventory-item={item.name}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink break-words">{item.name}</span>
          <span className={smallCls}>v systému {item.qtyText}</span>
        </span>
        <button type="button" className={`${btnPinkCls} !px-3`} disabled={busy} onClick={same} data-act="same">
          ✓ Sedí
        </button>
        <button type="button" className={`${btnNeutralCls} !px-3`} disabled={busy} onClick={() => setOpen(!open)} aria-expanded={open} data-act="other">
          Jinak…
        </button>
      </div>
      {open && (
        <form
          className="mt-2 flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault()
            other()
          }}
        >
          {withPacks && (
            <label className="flex-1 min-w-0">
              <span className={hintCls}>balení</span>
              <input className={`${inputCls} w-full text-center`} inputMode="numeric" value={packs} onChange={(e) => setPacks(e.target.value)} data-field="packs" autoFocus />
            </label>
          )}
          <label className="flex-1 min-w-0">
            <span className={hintCls}>{withPacks ? `+ ${item.unit}` : item.unit}</span>
            <input
              className={`${inputCls} w-full text-center`}
              inputMode={item.unit === 'ks' ? 'numeric' : 'decimal'}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              data-field="units"
              autoFocus={!withPacks}
            />
          </label>
          <button type="submit" className={btnPinkCls} disabled={busy} data-submit="count">
            Uložit
          </button>
        </form>
      )}
      {error && (
        <div className="text-[12.5px] font-semibold text-neg mt-1" data-error>
          {error}
        </div>
      )}
    </div>
  )
}

export default function InventoryTab({ items, meta, onSaved }: { items: StockItem[]; meta: StockMeta; onSaved: (i: StockItem) => void }) {
  const [done, setDone] = useState<{ name: string; qtyText: string }[]>([])
  const due = items.filter((i) => i.inventoryDue)
  const byPlace = useMemo(() => {
    const m = new Map<string, StockItem[]>()
    for (const i of due) m.set(i.location, [...(m.get(i.location) || []), i])
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'cs'))
  }, [due])
  const monday = mondayOfYmd(meta.today)

  const saved = (i: StockItem) => {
    setDone((d) => [...d, { name: i.name, qtyText: i.qtyText }])
    onSaved(i)
  }

  return (
    <div className="flex flex-col gap-3" data-inventory>
      <div className={hintCls}>
        Rychlá inventura — týden od {fmtCsDate(monday)}. Projděte místa, u každé položky „✓ Sedí“, nebo zadejte, kolik opravdu je.
      </div>
      {!due.length ? (
        <div className={`${cardCls} px-5 py-4 text-[13px] font-semibold text-pos`} data-inventory-done>
          ✓ Inventura tohoto týdne je hotová{items.length ? '' : ' (sklad je zatím prázdný)'}.
        </div>
      ) : (
        <>
          <div className="text-[13px] font-extrabold text-ink" data-inventory-left={due.length}>
            Zbývá přepočítat: {due.length}
          </div>
          {byPlace.map(([place, list]) => (
            <section key={place} className={`${cardCls} px-4 py-2`} data-inventory-place={place}>
              <h2 className={`${cardTitleCls} pt-1.5`}>📍 {place}</h2>
              {list.map((i) => (
                <InventoryRow key={i.documentId} item={i} onSaved={saved} />
              ))}
            </section>
          ))}
        </>
      )}
      {done.length > 0 && (
        <div className={smallCls} data-inventory-saved={done.length}>
          Uloženo: {done.map((d) => `${d.name} (${d.qtyText})`).join(', ')}
        </div>
      )}
    </div>
  )
}
