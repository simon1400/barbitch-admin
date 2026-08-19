// «Ke schválení» — блоки, заведённые администраторами, ждут подтверждения владельца.
// До подтверждения такой блок время НЕ занимает (клиенты могут забронировать слот),
// поэтому список открывается кнопкой в тулбаре календаря со счётчиком.
//
// Повторяющиеся блоки (серия) показываются ОДНОЙ строкой: подтверждать 72 дня
// по одному бессмысленно — кнопка применяет решение ко всей серии сразу.

import { useCallback, useEffect, useState } from 'react'
import { type PendingBlock, engineSetBlockApproval, fetchPendingBlocks } from '../fetch/engineApi'
import { blokPlural, fmtHM } from './helpers'
import { ModalShell } from './ui'

interface PendingBlocksProps {
  onClose: () => void
  // после подтверждения/отклонения — перечитать календарь (занятость изменилась)
  onChanged: () => void
}

interface PendingGroup {
  key: string
  head: PendingBlock // первый блок серии — им и оперируем (сервер сам разложит на серию)
  count: number
  lastDate: string
}

// «po 25. 8.» — день недели + D. M. (без года, как в остальном календаре)
const dayLabel = (d: string): string => {
  const dt = new Date(`${d}T00:00:00Z`)
  if (Number.isNaN(dt.getTime())) return d
  const dow = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][dt.getUTCDay()]
  return `${dow} ${dt.getUTCDate()}. ${dt.getUTCMonth() + 1}.`
}

const groupBySeries = (items: PendingBlock[]): PendingGroup[] => {
  const map = new Map<string, PendingGroup>()
  for (const b of items) {
    const key = b.seriesKey || b.documentId
    const g = map.get(key)
    if (g) {
      g.count += 1
      if (b.date > g.lastDate) g.lastDate = b.date
    } else {
      map.set(key, { key, head: b, count: 1, lastDate: b.date })
    }
  }
  return [...map.values()]
}

export const PendingBlocksModal = ({ onClose, onChanged }: PendingBlocksProps) => {
  const [groups, setGroups] = useState<PendingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPendingBlocks()
      setGroups(groupBySeries(res.items || []))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (g: PendingGroup, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      const what =
        g.count > 1
          ? `celou sérii — ${g.count} ${blokPlural(g.count)} (${g.head.employeeName})`
          : `blok ${dayLabel(g.head.date)} ${fmtHM(g.head.startMin ?? 0)}–${fmtHM(g.head.endMin ?? 0)} (${g.head.employeeName})`
      if (!window.confirm(`Zamítnout ${what}?`)) return
    }
    setBusyKey(g.key)
    setError(null)
    try {
      await engineSetBlockApproval(g.head.documentId, status, g.count > 1)
      setGroups((cur) => cur.filter((x) => x.key !== g.key))
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <ModalShell title={`Bloky ke schválení${groups.length ? ` (${groups.length})` : ''}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bloky zadané administrátorkami. Dokud je neschválíte, termín <b>neblokují</b> — klienti si ho můžou
          zarezervovat.
        </p>

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Načítám…</p>}

        {!loading && groups.length === 0 && (
          <p className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Nic nečeká na schválení.
          </p>
        )}

        {groups.map((g) => (
          <div
            key={g.key}
            className="rounded-lg border border-gray-200 dark:border-[#3f3f3d] bg-white dark:bg-[#252523] px-3 py-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {g.head.employeeName || '—'} · {dayLabel(g.head.date)}
                  {g.count > 1 && ` – ${dayLabel(g.lastDate)}`}
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  {fmtHM(g.head.startMin ?? 0)}–{fmtHM(g.head.endMin ?? 0)}
                  {g.head.title && g.head.title !== 'Blokace' && ` · ${g.head.title}`}
                  {g.count > 1 && ` · ${g.count} ${blokPlural(g.count)}`}
                </p>
                {g.head.createdByName && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">zadal/a: {g.head.createdByName}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyKey === g.key}
                  onClick={() => decide(g, 'approved')}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Schválit{g.count > 1 ? ` (${g.count})` : ''}
                </button>
                <button
                  type="button"
                  disabled={busyKey === g.key}
                  onClick={() => decide(g, 'rejected')}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                >
                  Zamítnout
                </button>
              </div>
            </div>
          </div>
        ))}

        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2e2e2c]"
          >
            Zavřít
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
