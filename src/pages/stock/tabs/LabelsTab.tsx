// «Štítky» (s251, §5.6 плана): выбрать позиции и места → «Tisk» открывает страницу A4
// с ярлыками (QR + название + место + минимум). QR — обычная ссылка на эту админку:
// позиция → `/stock/i/<documentId>` (экран с тремя кнопками), место → `/stock/l/<код>`
// (все позиции полки — для инвентуры). Код позиции не меняется при переименовании;
// место переименовали — ярлык места надо перепечатать.
import { useMemo, useState } from 'react'

import { btnNeutralCls, btnPinkCls, cardCls, cardTitleCls, hintCls } from '../../../ui/kit'
import type { StockItem } from '../fetch/stock'
import { smallCls } from '../stockText'

export default function LabelsTab({ items }: { items: StockItem[] }) {
  const places = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; count: number }>()
    for (const i of items) {
      const p = m.get(i.locationSlug) ?? { slug: i.locationSlug, name: i.location, count: 0 }
      p.count++
      m.set(i.locationSlug, p)
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [items])
  const [selItems, setSelItems] = useState<Set<string>>(new Set())
  const [selPlaces, setSelPlaces] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }
  const n = selItems.size + selPlaces.size
  const print = () => {
    const q = new URLSearchParams()
    if (selItems.size) q.set('items', [...selItems].join(','))
    if (selPlaces.size) q.set('places', [...selPlaces].join(','))
    window.open(`/stock/print?${q.toString()}`, '_blank', 'noopener')
  }

  if (!items.length) return <div className={hintCls}>Nejdřív založte položky.</div>

  const check = 'w-4 h-4 accent-brand shrink-0'
  return (
    <div className="flex flex-col gap-3.5">
      <div className={hintCls}>
        Vyberte štítky → „Tisk“ otevře stránku A4 (štítky 50 × 30 mm) — vytiskněte na samolepicí papír, rozstříhejte a nalepte. QR
        naskenuje běžný fotoaparát telefonu: štítek položky otevře „Spočítat / Přišlo / Došlo“, štítek místa — všechny položky na
        tom místě.
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnPinkCls} disabled={!n} onClick={print} data-print>
          Tisk ({n})
        </button>
        <button
          type="button"
          className={btnNeutralCls}
          onClick={() => {
            setSelItems(new Set(items.map((i) => i.documentId)))
            setSelPlaces(new Set(places.map((p) => p.slug)))
          }}
          data-select-all
        >
          Vybrat vše
        </button>
        {n > 0 && (
          <button
            type="button"
            className={btnNeutralCls}
            onClick={() => {
              setSelItems(new Set())
              setSelPlaces(new Set())
            }}
          >
            Zrušit výběr
          </button>
        )}
      </div>

      <section className={`${cardCls} px-5 py-4 flex flex-col gap-1.5`}>
        <h2 className={cardTitleCls}>Místa</h2>
        {places.map((p) => (
          <label key={p.slug} className="flex items-center gap-2.5 py-1 cursor-pointer" data-label-place={p.slug}>
            <input type="checkbox" className={check} checked={selPlaces.has(p.slug)} onChange={() => toggle(selPlaces, setSelPlaces, p.slug)} />
            <span className="text-[13.5px] font-semibold text-ink-body">
              📍 {p.name} <span className={smallCls}>· {p.count} pol.</span>
            </span>
          </label>
        ))}
      </section>

      <section className={`${cardCls} px-5 py-4 flex flex-col gap-1.5`}>
        <h2 className={cardTitleCls}>Položky</h2>
        {places.map((p) => (
          <div key={p.slug} className="flex flex-col gap-0.5">
            <div className={`${smallCls} mt-1.5`}>{p.name}</div>
            {items
              .filter((i) => i.locationSlug === p.slug)
              .map((i) => (
                <label key={i.documentId} className="flex items-center gap-2.5 py-1 cursor-pointer" data-label-item={i.documentId}>
                  <input type="checkbox" className={check} checked={selItems.has(i.documentId)} onChange={() => toggle(selItems, setSelItems, i.documentId)} />
                  <span className="text-[13.5px] font-semibold text-ink-body">{i.name}</span>
                </label>
              ))}
          </div>
        ))}
      </section>
    </div>
  )
}
