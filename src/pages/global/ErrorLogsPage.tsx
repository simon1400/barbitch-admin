import { useState, useEffect, useCallback } from 'react'
import { h1Cls, hintCls, kickerCls, pageShellCls } from '../../ui/kit'
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
  'window-error': 'bg-red-100 text-neg',
  'unhandled-rejection': 'bg-orange-100 text-warn',
  'react-error': 'bg-purple-100 text-purple-700',
  manual: 'bg-line-soft text-ink-body',
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
      <div className={pageShellCls}>
          <div className={kickerCls}>Barbitch Admin</div>
          <h1 className={h1Cls}>Error Logs</h1>
          <div className="mb-3.5">
            <p className={`m-0 ${hintCls}`}>
              Chyby z prohlížečů návštěvníků (window.onerror + unhandled promise + React errors).
              Stejné chyby jsou seskupené podle hashe (message + stack).
            </p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5 bg-line-soft rounded-lg p-1">
              {(['unresolved', 'all', 'resolved'] as ErrorFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${
                    filter === f
                      ? 'bg-white text-brand shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {f === 'unresolved' ? 'Nevyřešené' : f === 'resolved' ? 'Vyřešené' : 'Vše'}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="px-3 py-1.5 bg-white border border-line-btn rounded-md text-[12.5px] font-semibold text-ink-body hover:bg-surface-hover"
            >
              Obnovit
            </button>
            <button
              onClick={handleDeleteResolved}
              className="px-3 py-1.5 bg-white border border-neg-line rounded-md text-[12.5px] font-semibold text-neg hover:bg-neg-bg"
            >
              Smazat vyřešené
            </button>
            <span className="text-[12.5px] text-ink-soft ml-auto">
              {counts.unresolved} nevyřešené · {counts.resolved} vyřešené · {counts.all} celkem
            </span>
          </div>

          {actionMsg && (
            <div className="mb-4 p-3 rounded-lg text-[12.5px] bg-info-bg text-info">{actionMsg}</div>
          )}

          {loading ? (
            <div className="text-ink-soft">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-ink-soft bg-white rounded-lg p-8 text-center border">
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
                    className={`min-w-0 bg-white rounded-lg shadow-sm border ${
                      log.resolved ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(log.documentId)}
                      className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-hover"
                    >
                      <span
                        className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                          log.resolved ? 'bg-pos-bg0' : 'bg-neg-bg0'
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
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-warn">
                              dev
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-line-soft text-ink-body">
                            ×{log.count}
                          </span>
                          <span className="text-[11px] text-ink-faint">
                            {getRelativeTime(log.lastSeen)}
                          </span>
                        </div>
                        <div className="text-[12.5px] font-mono text-ink truncate">
                          {log.message}
                        </div>
                        {log.url && (
                          <div className="text-[11px] text-ink-faint truncate mt-0.5">
                            {log.url}
                          </div>
                        )}
                      </div>
                      <span className="text-ink-faint text-[12.5px] flex-shrink-0">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-line-soft pt-3 space-y-3">
                        {log.stack && (
                          <div>
                            <div className="text-[11px] font-semibold text-ink-soft mb-1">
                              Stack trace
                            </div>
                            <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="font-semibold text-ink-soft">First seen:</span>{' '}
                            <span className="text-ink-body">{formatDate(log.firstSeen)}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-ink-soft">Last seen:</span>{' '}
                            <span className="text-ink-body">{formatDate(log.lastSeen)}</span>
                          </div>
                          {log.userAgent && (
                            <div className="md:col-span-2">
                              <span className="font-semibold text-ink-soft">User Agent:</span>{' '}
                              <span className="text-ink-body break-all">{log.userAgent}</span>
                            </div>
                          )}
                          {log.sessionId && (
                            <div className="md:col-span-2">
                              <span className="font-semibold text-ink-soft">Session:</span>{' '}
                              <span className="text-ink-body font-mono">{log.sessionId}</span>
                            </div>
                          )}
                          <div className="md:col-span-2 text-[10px] text-ink-faint">
                            Hash: {log.errorHash}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleToggleResolved(log)}
                            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold ${
                              log.resolved
                                ? 'bg-yellow-100 text-warn hover:bg-yellow-200'
                                : 'bg-green-100 text-pos hover:bg-green-200'
                            }`}
                          >
                            {log.resolved ? 'Označit jako nevyřešené' : 'Označit jako vyřešené'}
                          </button>
                          <button
                            onClick={() => handleDelete(log)}
                            className="px-3 py-1.5 rounded-md text-[12.5px] font-semibold bg-neg-bg text-neg hover:bg-red-100"
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
      </div>
    </OwnerProtection>
  )
}
