// «Deník» (s251): журнал движений склада — кто, когда, сколько было и стало. По 50, «Načíst další».
import { useCallback, useEffect, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { btnNeutralCls, cardCls, hintCls } from '../../../ui/kit'
import { fetchStockMoves, type StockMove } from '../fetch/stock'
import { MoveRow } from '../components/StockParts'

const PAGE = 50

export default function LogTab({ reloadKey }: { reloadKey: number }) {
  const [moves, setMoves] = useState<StockMove[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    fetchStockMoves({ limit: PAGE })
      .then((r) => {
        if (!alive) return
        setMoves(r.moves)
        setHasMore(r.hasMore)
      })
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst')))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const more = useCallback(async () => {
    const last = moves?.at(-1)?.at
    if (!last) return
    setBusy(true)
    try {
      const r = await fetchStockMoves({ before: last, limit: PAGE })
      setMoves((m) => [...(m || []), ...r.moves])
      setHasMore(r.hasMore)
    } catch (e) {
      setError(errMsg(e, 'Nepodařilo se načíst'))
    } finally {
      setBusy(false)
    }
  }, [moves])

  if (error && !moves) return <div className="text-[12.5px] font-semibold text-neg">{error}</div>
  if (!moves) return <div className={hintCls}>Načítám…</div>
  if (!moves.length) return <div className={`${cardCls} px-5 py-4 ${hintCls}`}>Zatím žádné záznamy.</div>
  return (
    <div className="flex flex-col gap-3">
      <div className={`${cardCls} px-4 py-1.5`} data-log>
        {moves.map((m) => (
          <MoveRow key={m.documentId} move={m} showItem />
        ))}
      </div>
      {error && <div className="text-[12.5px] font-semibold text-neg">{error}</div>}
      {hasMore && (
        <button type="button" className={`${btnNeutralCls} self-start`} onClick={() => void more()} disabled={busy} data-more>
          Načíst další
        </button>
      )}
    </div>
  )
}
