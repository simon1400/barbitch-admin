import { useState, useEffect, useMemo } from 'react'
import {
  getEmployees,
  getActivities,
  getBlockedTimes,
  buildActivityItems,
  type ActivityItem,
} from '../fetch/noonaActivity'

const ACTION_COLORS: Record<string, string> = {
  event_created: 'bg-green-100 text-green-800',
  event_deleted: 'bg-red-100 text-red-800',
  event_cancelled: 'bg-orange-100 text-orange-800',
  event_duration_changed: 'bg-yellow-100 text-yellow-800',
  calendar_block: 'bg-purple-100 text-purple-800',
}

const ACTION_LABELS: Record<string, string> = {
  event_created: 'Nová rezervace',
  event_deleted: 'Smazání',
  event_cancelled: 'Zrušení',
  event_duration_changed: 'Změna délky',
  calendar_block: 'Blokace kalendáře',
}

const PERIOD_OPTIONS = [
  { value: 7, label: 'Posledních 7 dní' },
  { value: 14, label: 'Posledních 14 dní' },
  { value: 30, label: 'Posledních 30 dní' },
]

export const NoonaActivityLog = () => {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterActor, setFilterActor] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [periodDays, setPeriodDays] = useState(7)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

        const [emps, activities, blocks] = await Promise.all([
          getEmployees(),
          getActivities(from),
          getBlockedTimes(from.toISOString(), now.toISOString()),
        ])
        const empMap = new Map(emps.map((e) => [e.id, e.name]))
        const allItems = buildActivityItems(activities, blocks, empMap)
        setItems(allItems)
      } catch (err) {
        console.error(err)
        setError('Nepodařilo se načíst data z Noona')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [periodDays])

  const filteredItems = useMemo(() => {
    let result = items

    if (filterActor !== 'all') {
      result = result.filter((i) => i.actorId === filterActor)
    }

    if (filterAction !== 'all') {
      result = result.filter((i) => i.actionType === filterAction)
    }

    return result
  }, [items, filterActor, filterAction])

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
        <span className="ml-3 text-gray-600">Načítám historii z Noona...</span>
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
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

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

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Všechny akce</option>
          <option value="event_created">Nová rezervace</option>
          <option value="event_deleted">Smazání</option>
          <option value="event_cancelled">Zrušení</option>
          <option value="event_duration_changed">Změna délky</option>
          <option value="calendar_block">Blokace kalendáře</option>
        </select>
      </div>

      {/* Stats */}
      <div className="mb-4 text-sm text-gray-500">
        Zobrazeno: {filteredItems.length} z {items.length} záznamů
      </div>

      {/* Activity list */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          Žádné záznamy
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ActivityRow
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

const ActivityRow = ({
  item,
  formatTimestamp,
}: {
  item: ActivityItem
  formatTimestamp: (iso: string) => string
}) => {
  const colorClass =
    ACTION_COLORS[item.actionType] || 'bg-gray-100 text-gray-800'
  const label = ACTION_LABELS[item.actionType] || item.actionType

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
            >
              {label}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {item.actorName}
            </span>
          </div>
          <p className="text-sm text-gray-700">{item.description}</p>
          {item.details && (
            <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3">
              {item.details.serviceName && (
                <span>Služba: {item.details.serviceName}</span>
              )}
              {item.details.employeeName && (
                <span>Mistr: {item.details.employeeName}</span>
              )}
              {item.details.startsAt && (
                <span>Termín: {formatTimestamp(item.details.startsAt)}</span>
              )}
              {item.details.blockDate && (
                <span>
                  Den: {item.details.blockDate}, {item.details.blockFrom}–
                  {item.details.blockTo}
                </span>
              )}
              {item.details.blockTitle &&
                item.details.blockTitle !== 'Bez důvodu' && (
                  <span>Důvod: {item.details.blockTitle}</span>
                )}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatTimestamp(item.timestamp)}
        </span>
      </div>
    </div>
  )
}
