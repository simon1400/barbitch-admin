// Печать ярлыков склада (/stock/print?items=…&places=…, s251): лист A4, ярлыки 50 × 30 мм
// с пунктирной рамкой для резки. Без шапки админки — только сетка и кнопка «Tisknout»
// (в печать не попадает). После загрузки диалог печати открывается сам.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errMsg } from '../../lib/errMsg'
import { btnPinkCls, hintCls } from '../../ui/kit'
import { fetchStock, itemQrUrl, locationQrUrl, type StockItem } from './fetch/stock'
import { QrCode } from './components/QrCode'

const PRINT_CSS = `
@page { size: A4; margin: 8mm; }
@media print { .no-print { display: none !important; } body { background: #fff !important; } }
.stock-labels { display: grid; grid-template-columns: repeat(auto-fill, 50mm); gap: 2mm; }
.stock-label { box-sizing: border-box; width: 50mm; height: 30mm; border: 0.2mm dashed #999; padding: 2mm;
  display: flex; gap: 2mm; align-items: center; overflow: hidden; break-inside: avoid; page-break-inside: avoid;
  font-family: system-ui, sans-serif; color: #000; background: #fff; }
.stock-label .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.8mm; }
.stock-label .n { font-size: 9pt; font-weight: 800; line-height: 1.15; word-break: break-word; }
.stock-label .s { font-size: 7pt; line-height: 1.2; }
`

interface Label {
  key: string
  url: string
  title: string
  sub: string
  sub2: string
}

const split = (s: string | null): Set<string> => new Set((s || '').split(',').map((x) => x.trim()).filter(Boolean))

export default function StockPrintPage() {
  const [params] = useSearchParams()
  const [labels, setLabels] = useState<Label[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const printed = useRef(false)

  useEffect(() => {
    let alive = true
    const wantItems = split(params.get('items'))
    const wantPlaces = split(params.get('places'))
    fetchStock()
      .then(({ items }) => {
        if (!alive) return
        const byName = (a: StockItem, b: StockItem) => a.location.localeCompare(b.location, 'cs') || a.name.localeCompare(b.name, 'cs')
        const places = new Map<string, StockItem>()
        for (const i of items) if (wantPlaces.has(i.locationSlug) && !places.has(i.locationSlug)) places.set(i.locationSlug, i)
        setLabels([
          ...[...places.values()].map((i) => ({
            key: `l:${i.locationSlug}`,
            url: locationQrUrl(i.locationSlug),
            title: `📍 ${i.location}`,
            sub: 'Všechny položky na tomto místě',
            sub2: 'Naskenujte → inventura',
          })),
          ...items
            .filter((i) => wantItems.has(i.documentId))
            .sort(byName)
            .map((i) => ({
              key: `i:${i.documentId}`,
              url: itemQrUrl(i.documentId),
              title: i.name,
              sub: `📍 ${i.location}`,
              sub2: `min ${i.minText}`,
            })),
        ])
      })
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst sklad')))
    return () => {
      alive = false
    }
  }, [params])

  useEffect(() => {
    if (!labels?.length || printed.current) return
    printed.current = true
    const t = setTimeout(() => {
      try {
        window.print()
      } catch {
        /* печать недоступна (встроенный браузер) — остаётся кнопка */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [labels])

  return (
    <div className="p-4 bg-white min-h-screen">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex items-center gap-3 mb-4 flex-wrap">
        <button type="button" className={btnPinkCls} onClick={() => window.print()} disabled={!labels?.length}>
          Tisknout
        </button>
        <span className={hintCls}>
          {labels ? `${labels.length} štítků · A4, 50 × 30 mm · tiskněte ve skutečné velikosti (100 %)` : error ? '' : 'Načítám…'}
        </span>
      </div>
      {error && <div className="no-print text-[13px] font-semibold text-neg">{error}</div>}
      {labels && !labels.length && <div className={hintCls}>Nic k tisku — vyberte štítky v modulu Sklad.</div>}
      <div className="stock-labels" data-labels>
        {labels?.map((l) => (
          <div key={l.key} className="stock-label" data-label={l.key}>
            <QrCode text={l.url} size="24mm" label={l.title} />
            <div className="t">
              <div className="n">{l.title}</div>
              <div className="s">{l.sub}</div>
              <div className="s">{l.sub2}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
