// Ручная корректировка баланса. Перенесено из LoyaltyPage.tsx (этап 6) дословно.
import { useRef, useState } from 'react'
import type { ClientHit } from '../fetch/loyalty'
import { createManualTransaction, searchLoyaltyClients } from '../fetch/loyalty'

// ── ручная корректировка ──

export function ManualAdjustment({ cardYear, onDone }: { cardYear: number; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ClientHit[]>([])
  const [selected, setSelected] = useState<ClientHit | null>(null)
  const [delta, setDelta] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onQuery = (v: string) => {
    setQuery(v)
    setSelected(null)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        setHits(v.trim().length >= 2 ? await searchLoyaltyClients(v) : [])
      } catch {
        setHits([])
      }
    }, 300)
  }

  const submit = async () => {
    const value = Number(delta)
    if (!selected || !value || !comment.trim()) return
    if (!window.confirm(`${selected.name}: ${value > 0 ? '+' : ''}${value} Kč — записать?`)) return
    setBusy(true)
    setMsg(null)
    try {
      await createManualTransaction({
        clientDocId: selected.documentId,
        delta: value,
        cardYear,
        comment: comment.trim(),
      })
      setMsg(`✓ ${selected.name}: ${value > 0 ? '+' : ''}${value} Kč записано`)
      setQuery('')
      setHits([])
      setSelected(null)
      setDelta('')
      setComment('')
      onDone()
    } catch (e) {
      setMsg(`Ошибка: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'bg-white shadow-md rounded-xl p-4 mb-6'}>
      <h3 className={'text-2xl font-bold mb-3'}>Ручная корректировка ± Kč</h3>
      <div className={'flex flex-col gap-2 md:flex-row md:items-start'}>
        <div className={'relative md:w-72'}>
          <input
            className={'w-full border border-line-btn rounded-lg px-3 py-2 text-sm'}
            placeholder={'Клиент: имя / e-mail / телефон'}
            value={selected ? selected.name : query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {!selected && hits.length > 0 && (
            <div
              className={
                'absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-64 overflow-auto'
              }
            >
              {hits.map((h) => (
                <button
                  key={h.documentId}
                  type={'button'}
                  className={'block w-full text-left px-3 py-2 text-sm hover:bg-pink-50'}
                  onClick={() => {
                    setSelected(h)
                    setHits([])
                  }}
                >
                  <span className={'font-medium'}>{h.name}</span>
                  <span className={'text-ink-soft'}> · {h.email || h.phone || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          className={'border border-line-btn rounded-lg px-3 py-2 text-sm md:w-32'}
          placeholder={'±Kč (напр. -500)'}
          value={delta}
          onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))}
        />
        <input
          className={'border border-line-btn rounded-lg px-3 py-2 text-sm flex-1'}
          placeholder={'Комментарий (обязателен)'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type={'button'}
          disabled={busy || !selected || !Number(delta) || !comment.trim()}
          onClick={submit}
          className={
            'px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand disabled:opacity-40'
          }
        >
          {busy ? 'Записываю…' : 'Записать'}
        </button>
      </div>
      {msg && <p className={'mt-2 text-sm text-ink-body'}>{msg}</p>}
      <p className={'mt-2 text-xs text-ink-soft'}>
        Создаёт транзакцию reason=manual за {cardYear} год; пересечение порога сразу создаёт награду.
      </p>
    </div>
  )
}
