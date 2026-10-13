// Экран одной позиции (/stock/i/:docId, s251) — сюда ведёт QR-ярлык на полке: крупные
// кнопки «Spočítat / Přišlo / Došlo», текущий остаток и последние движения. Руководству —
// ещё «Upravit» (настройки позиции на вкладке «Nastavení»).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { errMsg } from '../../lib/errMsg'
import { btnNeutralCls, cardCls, cardTitleCls, h1Cls, hintCls, kickerCls, pageShellCls } from '../../ui/kit'
import { fetchStockItem, type StockItem, type StockMeta, type StockMove } from './fetch/stock'
import { MoveForm } from './components/MoveForm'
import { MoveRow, StatusChip } from './components/StockParts'
import { countedText, smallCls } from './stockText'

export default function StockItemPage() {
  const { docId = '' } = useParams()
  const [item, setItem] = useState<StockItem | null>(null)
  const [meta, setMeta] = useState<StockMeta | null>(null)
  const [moves, setMoves] = useState<StockMove[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await fetchStockItem(docId)
      setItem(r.item)
      setMeta(r.meta)
      setMoves(r.moves)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se načíst položku'))
    }
  }, [docId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={`${pageShellCls} !max-w-[560px]`}>
      <Link to="/stock" className="text-[12.5px] font-bold text-brand-dark hover:underline">
        ← Celý sklad
      </Link>
      {error && <div className="mt-3 text-[13px] font-semibold text-neg" data-error>{error}</div>}
      {!item && !error && <div className={`${hintCls} mt-3`}>Načítám…</div>}
      {item && (
        <div className="mt-3 flex flex-col gap-3.5" data-stock-item={item.documentId}>
          <div>
            <div className={kickerCls}>📍 {item.location}</div>
            <h1 className={`${h1Cls} !mb-1`}>{item.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={item.status} />
              <span className="text-[20px] font-extrabold text-ink" data-qty>
                {item.qtyText}
              </span>
              <span className={smallCls}>min {item.minText}</span>
            </div>
            <div className={`${smallCls} mt-1`}>
              {countedText(item)}
              {item.countDue && <span className="text-warn"> · přepočítat</span>}
              {/* s252: уже заказано — второй раз не заказывать */}
              {item.onOrderPacks > 0 && (
                <Link to="/stock?tab=orders" className="text-brand-dark hover:underline" data-on-order={item.onOrderPacks}>
                  {' '}
                  · objednáno {item.onOrderPacks} {item.packSize > 1 ? 'bal.' : item.unit}
                </Link>
              )}
            </div>
            {item.note && <div className={`${hintCls} mt-1`}>{item.note}</div>}
          </div>

          <section className={`${cardCls} px-4 py-4`}>
            <MoveForm
              item={item}
              large
              onSaved={(next) => {
                setItem(next)
                void load()
              }}
            />
          </section>

          {meta?.canEdit && (
            <Link to={`/stock?tab=settings&edit=${encodeURIComponent(item.documentId)}`} className={`${btnNeutralCls} self-start no-underline`}>
              Upravit položku
            </Link>
          )}

          {moves.length > 0 && (
            <section className={`${cardCls} px-4 py-3`}>
              <h2 className={`${cardTitleCls} mb-1`}>Poslední pohyby</h2>
              {moves.map((m) => (
                <MoveRow key={m.documentId} move={m} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
