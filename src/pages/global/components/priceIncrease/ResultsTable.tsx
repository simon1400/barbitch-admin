import type { ApplyResult } from '../../fetch/priceIncrease'

interface Props {
  results: ApplyResult[]
  onRetryFailed: () => void
  isRetrying: boolean
}

export const ResultsTable = ({ results, onRetryFailed, isRetrying }: Props) => {
  if (results.length === 0) return null
  const ok = results.filter((r) => r.status === 'ok')
  const failed = results.filter((r) => r.status === 'error')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mt-4">
      <div className="flex items-baseline justify-between mb-4">
        <span className="font-semibold text-gray-700 text-sm">Результат</span>
        <div className="text-xs">
          <span className="text-green-600 font-semibold">✓ {ok.length}</span>
          {failed.length > 0 && (
            <span className="ml-3 text-red-600 font-semibold">✗ {failed.length}</span>
          )}
        </div>
      </div>

      {failed.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
              Ошибки ({failed.length})
            </p>
            <button
              onClick={onRetryFailed}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {isRetrying ? 'Повторяем…' : `Повторить ${failed.length}`}
            </button>
          </div>
          <div className="space-y-1.5">
            {failed.map((r) => (
              <div
                key={r.change.key}
                className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-800 truncate" title={r.change.label}>
                    {r.change.label}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {r.change.before} → {r.change.after}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">{r.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ok.length > 0 && (
        <details>
          <summary className="text-xs font-semibold text-green-700 uppercase tracking-wide cursor-pointer hover:text-green-800">
            Успешно ({ok.length}) — показать
          </summary>
          <div className="space-y-1 mt-2 max-h-72 overflow-y-auto">
            {ok.map((r) => (
              <div
                key={r.change.key}
                className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
              >
                <span className="text-green-600 shrink-0">✓</span>
                <span className="flex-1 text-sm text-gray-700 truncate" title={r.change.label}>
                  {r.change.label}
                </span>
                <span className="text-xs text-gray-400 font-mono shrink-0">
                  {r.change.before} → {r.change.after}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
