import { useState, useEffect, useMemo } from 'react'
import {
  getEmployees,
  getBlockedTimes,
  buildBlockItems,
  type BlockItem,
} from '../fetch/noonaActivity'

export const NoonaActivityLog = () => {
  const [items, setItems] = useState<BlockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterActor, setFilterActor] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [emps, blocks] = await Promise.all([
          getEmployees(),
          getBlockedTimes(from.toISOString(), now.toISOString()),
        ])
        const empMap = new Map(emps.map((e) => [e.id, e.name]))
        setItems(buildBlockItems(blocks, empMap))
      } catch (err) {
        console.error(err)
        setError('Nepodařilo se načíst data z Noona')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const LIMIT = 30

  const filteredItems = useMemo(() => {
    const filtered = filterActor === 'all'
      ? items
      : items.filter((i) => i.actorId === filterActor)
    return filtered.slice(0, LIMIT)
  }, [items, filterActor])

  const uniqueActors = useMemo(() => {
    const seen = new Map<string, string>()
    items.forEach((i) => {
      seen.set(i.actorId, i.actorName)
    })
    return Array.from(seen.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    )
  }, [items])

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Prague',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800" />
        <span className="ml-3 text-gray-600">Načítám blokace z Noona...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div>
      {/* Filter by actor */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Všichni zaměstnanci</option>
          {uniqueActors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="mb-4 text-sm text-gray-500">
        Posledních {filteredItems.length} záznamů
      </div>

      {/* Block list */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          Žádné blokace za posledních 30 dní
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <BlockRow
              key={item.id}
              item={item}
              formatTimestamp={formatTimestamp}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const BlockRow = ({
  item,
  formatTimestamp,
}: {
  item: BlockItem
  formatTimestamp: (iso: string) => string
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Blokace kalendáře
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {item.actorName}
            </span>
          </div>
          <p className="text-sm text-gray-700">{item.description}</p>
          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3">
            <span>
              Den: {item.details.blockDate}, {item.details.blockFrom}–
              {item.details.blockTo}
            </span>
            {item.details.blockTitle !== 'Bez důvodu' && (
              <span>Důvod: {item.details.blockTitle}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatTimestamp(item.timestamp)}
        </span>
      </div>
    </div>
  )
}
