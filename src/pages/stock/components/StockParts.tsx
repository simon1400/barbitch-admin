// Общие кусочки модуля «Sklad» (s251): статус-чип, строка позиции со сворачиваемой
// формой движения, строка журнала.
import { Link } from 'react-router-dom'

import { badgeNegCls, badgePosCls, badgeWarnCls, bodyBoldCls } from '../../../ui/kit'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { STATUS_LABEL, type StockItem, type StockMove, type StockStatus } from '../fetch/stock'
import { countedText, moveKindText, smallCls } from '../stockText'
import { MoveForm } from './MoveForm'

const CHIP: Record<StockStatus, string> = { ok: badgePosCls, low: badgeWarnCls, out: badgeNegCls }

export function StatusChip({ status }: { status: StockStatus }) {
  return (
    <span className={`${CHIP[status]} whitespace-nowrap`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  )
}

interface RowProps {
  item: StockItem
  expanded: boolean
  onToggle: () => void
  onSaved: (item: StockItem) => void
  /** не показывать место (список одного места) */
  hideLocation?: boolean
}

export function ItemRow({ item, expanded, onToggle, onSaved, hideLocation }: RowProps) {
  return (
    <div className="py-2.5 border-t border-line-soft first:border-t-0" data-item={item.documentId} data-item-name={item.name}>
      <button type="button" className="w-full flex items-start gap-3 text-left bg-transparent border-0 p-0 cursor-pointer" onClick={onToggle} aria-expanded={expanded}>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink break-words">{item.name}</span>
          <span className={smallCls}>
            {!hideLocation && `${item.location} · `}
            {countedText(item)}
            {item.countDue && <span className="text-warn"> · přepočítat</span>}
            {item.onOrderPacks > 0 && <span data-on-order={item.onOrderPacks}> · objednáno {item.onOrderPacks}</span>}
          </span>
        </span>
        <span className="shrink-0 text-right flex flex-col items-end gap-1">
          <StatusChip status={item.status} />
          <span className={`${bodyBoldCls} whitespace-nowrap`} data-qty>
            {item.qtyText}
          </span>
          <span className={smallCls}>min {item.minText}</span>
        </span>
      </button>
      {expanded && (
        <div className="mt-2.5 flex flex-col gap-2">
          <MoveForm item={item} onSaved={onSaved} />
          <Link to={`/stock/i/${encodeURIComponent(item.documentId)}`} className="self-start text-[12.5px] font-bold text-brand-dark hover:underline">
            Detail a historie →
          </Link>
        </div>
      )}
    </div>
  )
}

export function MoveRow({ move, showItem }: { move: StockMove; showItem?: boolean }) {
  const day = move.at ? ymdPrague(move.at) : null
  return (
    <div className="flex items-start gap-3 py-2 border-t border-line-soft first:border-t-0" data-move={move.kind}>
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">
        {showItem && (
          <Link to={`/stock/i/${encodeURIComponent(move.itemDocId)}`} className="font-bold text-ink hover:underline">
            {move.itemName}
          </Link>
        )}
        {showItem && ' · '}
        {moveKindText(move)}: {move.beforeText} → <b className="text-ink">{move.afterText}</b>
        <span className={`${smallCls} ml-1`}>({move.deltaText})</span>
        {move.note && <div className={smallCls}>„{move.note}“</div>}
      </span>
      <span className={`${smallCls} shrink-0 text-right`}>
        {day ? `${fmtCsDate(day)} ${fmtTimePrague(move.at)}` : '—'}
        <br />
        {move.by}
      </span>
    </div>
  )
}
