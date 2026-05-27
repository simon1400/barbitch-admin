import type { OpResult } from '../../fetch/manageServices'

interface Props {
  results: OpResult[]
  onRetryFailed: () => void
  isRetrying: boolean
}

export const ResultsTable = ({ results, onRetryFailed, isRetrying }: Props) => {
  if (results.length === 0) return null
  const okCount = results.filter((r) => r.status === 'ok').length
  const errCount = results.filter((r) => r.status === 'error').length

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">
          Результат: <span className="text-green-600">{okCount} OK</span>
          {errCount > 0 && <span className="text-red-600 ml-3">{errCount} ошибок</span>}
        </div>
        {errCount > 0 && (
          <button
            type="button"
            onClick={onRetryFailed}
            disabled={isRetrying}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isRetrying ? 'Повтор…' : `Повторить ${errCount} упавших`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Операция</th>
              <th className="py-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.planned.key} className="border-b last:border-b-0">
                <td className="py-2 text-gray-700">{r.planned.label}</td>
                <td className="py-2">
                  {r.status === 'ok' ? (
                    <span className="text-green-600 text-xs font-semibold">OK</span>
                  ) : (
                    <span className="text-red-600 text-xs">{r.error}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
