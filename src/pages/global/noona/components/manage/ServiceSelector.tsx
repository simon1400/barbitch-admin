import { useMemo, useState } from 'react'
import type { StrapiAddonGroup } from '../../fetch/manageServices'

interface Props {
  groups: StrapiAddonGroup[]
  selectedId: string | null
  onSelect: (group: StrapiAddonGroup) => void
  disabled?: boolean
}

export const ServiceSelector = ({ groups, selectedId, onSelect, disabled }: Props) => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...groups].sort((a, b) => a.title.localeCompare(b.title, 'cs'))
    if (!q) return sorted
    return sorted.filter((g) => g.title.toLowerCase().includes(q))
  }, [groups, query])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
      <span className="font-semibold text-gray-600 text-sm">Выбери услугу</span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по названию…"
        disabled={disabled}
        className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <div className="mt-3 max-h-60 overflow-y-auto flex flex-col gap-1">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Ничего не найдено</div>
        ) : (
          filtered.map((g) => (
            <button
              key={g.documentId}
              type="button"
              onClick={() => onSelect(g)}
              disabled={disabled}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                g.documentId === selectedId
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="font-semibold">{g.title}</span>
              <span className={g.documentId === selectedId ? 'opacity-80' : 'text-gray-400'}>
                {`  · ${g.base_price} Kč · ${g.addons.length} вар. · ${g.modifiers.length} доп.`}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
