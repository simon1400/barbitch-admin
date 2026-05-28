import { useState, useEffect, useCallback } from 'react'
import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import type { ClientErrorLog, ErrorFilter } from './fetch/errorLogs'
import {
  fetchErrorLogs,
  updateErrorLog,
  deleteErrorLog,
  deleteAllResolved,
} from './fetch/errorLogs'

const SOURCE_LABELS: Record<ClientErrorLog['source'], string> = {
  'window-error': 'window.onerror',
  'unhandled-rejection': 'promise',
  'react-error': 'React',
  manual: 'manual',
}

const SOURCE_COLORS: Record<ClientErrorLog['source'], string> = {
  'window-error': 'bg-red-100 text-red-700',
  'unhandled-rejection': 'bg-orange-100 text-orange-700',
  'react-error': 'bg-purple-100 text-purple-700',
  manual: 'bg-gray-100 text-gray-700',
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRelativeTime(s: string | null): string {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `před ${hours} h`
  const days = Math.floor(hours / 24)
  return `před ${days} d`
}

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<ClientErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ErrorFilter>('unresolved')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchErrorLogs(filter)
      setLogs(data)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleResolved = async (log: ClientErrorLog) => {
    try {
      await updateErrorLog(log.documentId, { resolved: !log.resolved })
      setLogs((prev) =>
        prev.map((l) =>
          l.documentId === log.documentId ? { ...l, resolved: !log.resolved } : l,
        ),
      )
    } catch (err: unknown) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  const handleDelete = async (log: ClientErrorLog) => {
    if (!window.confirm('Smazat tento záznam?')) return
    try {
      await deleteErrorLog(log.documentId)
      setLogs((prev) => prev.filter((l) => l.documentId !== log.documentId))
    } catch (err: unknown) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  const handleDeleteResolved = async () => {
    if (!window.confirm('Smazat všechny vyřešené chyby?')) return
    try {
      const n = await deleteAllResolved()
      setActionMsg(`Smazáno: ${n}`)
      await load()
    } catch (err: unknown) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  const counts = {
    all: logs.length,
    unresolved: logs.filter((l) => !l.resolved).length,
    resolved: logs.filter((l) => l.resolved).length,
  }

  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="mt-8 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Client Error Logs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Chyby z prohlížečů návštěvníků (window.onerror + unhandled promise + React errors).
              Stejné chyby jsou seskupené podle hashe (message + stack).
            </p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1">
              {(['unresolved', 'all', 'resolved'] as ErrorFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xss font-semibold transition-colors ${
                    filter === f
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f === 'unresolved' ? 'Nevyřešené' : f === 'resolved' ? 'Vyřešené' : 'Vše'}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xss font-semibold text-gray-700 hover:bg-gray-50"
            >
              Obnovit
            </button>
            <button
              onClick={handleDeleteResolved}
              className="px-3 py-1.5 bg-white border border-red-200 rounded-md text-xss font-semibold text-red-600 hover:bg-red-50"
            >
              Smazat vyřešené
            </button>
            <span className="text-xss text-gray-500 ml-auto">
              {counts.unresolved} nevyřešené · {counts.resolved} vyřešené · {counts.all} celkem
            </span>
          </div>

          {actionMsg && (
            <div className="mb-4 p-3 rounded-lg text-xss bg-blue-50 text-blue-700">{actionMsg}</div>
          )}

          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500 bg-white rounded-lg p-8 text-center border">
              {filter === 'unresolved'
                ? 'Žádné nevyřešené chyby. 🎉'
                : 'Žádné záznamy.'}
            </div>
          ) : (
            <div className="grid gap-2">
              {logs.map((log) => {
                const isOpen = expanded.has(log.documentId)
                return (
                  <div
                    key={log.documentId}
                    className={`bg-white rounded-lg shadow-sm border ${
                      log.resolved ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(log.documentId)}
                      className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50"
                    >
                      <span
                        className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                          log.resolved ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SOURCE_COLORS[log.source]}`}
                          >
                            {SOURCE_LABELS[log.source]}
                          </span>
                          {log.environment === 'development' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                              dev
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            ×{log.count}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {getRelativeTime(log.lastSeen)}
                          </span>
                        </div>
                        <div className="text-xss font-mono text-gray-800 truncate">
                          {log.message}
                        </div>
                        {log.url && (
                          <div className="text-[11px] text-gray-400 truncate mt-0.5">
                            {log.url}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-400 text-xss flex-shrink-0">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        {log.stack && (
                          <div>
                            <div className="text-[11px] font-semibold text-gray-500 mb-1">
                              Stack trace
                            </div>
                            <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="font-semibold text-gray-500">First seen:</span>{' '}
                            <span className="text-gray-700">{formatDate(log.firstSeen)}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500">Last seen:</span>{' '}
                            <span className="text-gray-700">{formatDate(log.lastSeen)}</span>
                          </div>
                          {log.userAgent && (
                            <div className="md:col-span-2">
                              <span className="font-semibold text-gray-500">User Agent:</span>{' '}
                              <span className="text-gray-700 break-all">{log.userAgent}</span>
                            </div>
                          )}
                          {log.sessionId && (
                            <div className="md:col-span-2">
                              <span className="font-semibold text-gray-500">Session:</span>{' '}
                              <span className="text-gray-700 font-mono">{log.sessionId}</span>
                            </div>
                          )}
                          <div className="md:col-span-2 text-[10px] text-gray-400">
                            Hash: {log.errorHash}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleToggleResolved(log)}
                            className={`px-3 py-1.5 rounded-md text-xss font-semibold ${
                              log.resolved
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {log.resolved ? 'Označit jako nevyřešené' : 'Označit jako vyřešené'}
                          </button>
                          <button
                            onClick={() => handleDelete(log)}
                            className="px-3 py-1.5 rounded-md text-xss font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Smazat
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Container>
      </section>
    </OwnerProtection>
  )
}
