import { useState } from 'react'

import {
  categoryState,
  type NoonaCategory,
  type ServiceMeta,
} from '../../fetch/masterServices'
import { Switch } from './Switch'

interface Props {
  category: NoonaCategory
  serviceMeta: Map<string, ServiceMeta>
  enabledMap: Map<string, boolean>
  originalMap: Map<string, boolean>
  onToggleService: (id: string) => void
  onToggleCategory: (serviceIds: string[], nextEnabled: boolean) => void
  disabled?: boolean
  filter?: string
}

export const CategoryRow = ({
  category,
  serviceMeta,
  enabledMap,
  originalMap,
  onToggleService,
  onToggleCategory,
  disabled,
  filter,
}: Props) => {
  const [expanded, setExpanded] = useState(false)

  // Only services we actually know (present in event_types) — dedup ids.
  const knownIds = [...new Set(category.serviceIds)].filter((id) => enabledMap.has(id))
  if (knownIds.length === 0) return null

  // When a title filter is active, narrow to matching combos, auto-expand and hide the
  // rest so the master sees exactly what a bulk toggle will affect.
  const filterTrim = (filter ?? '').trim().toLowerCase()
  const visibleIds = filterTrim
    ? knownIds.filter((id) => (serviceMeta.get(id)?.title ?? '').toLowerCase().includes(filterTrim))
    : knownIds
  if (visibleIds.length === 0) return null

  const state = categoryState(visibleIds, enabledMap)
  const enabledCount = visibleIds.filter((id) => enabledMap.get(id)).length
  const changedCount = visibleIds.filter((id) => enabledMap.get(id) !== originalMap.get(id)).length
  const isExpanded = Boolean(filterTrim) || expanded

  // Whole-category toggle operates on what is currently visible (the filtered subset when
  // a filter is active, otherwise the whole category): everything on → turn off, else all on.
  const handleCategoryToggle = () => onToggleCategory(visibleIds, state !== 'on')

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={Boolean(filterTrim)}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-gray-400 text-xs w-4 shrink-0">{isExpanded ? '▾' : '▸'}</span>
          <span className="font-semibold text-gray-800 text-sm truncate">{category.title}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {enabledCount}/{visibleIds.length}
            {filterTrim && <span className="text-primary"> найдено</span>}
            {changedCount > 0 && <span className="text-amber-600 font-semibold"> · ±{changedCount}</span>}
          </span>
        </button>
        <Switch
          state={state}
          onClick={handleCategoryToggle}
          disabled={disabled}
          title={filterTrim ? 'Найденные в категории вкл/выкл' : 'Вся категория вкл/выкл'}
        />
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {visibleIds.map((id) => {
            const meta = serviceMeta.get(id)
            const enabled = enabledMap.get(id) ?? false
            const changed = enabled !== originalMap.get(id)
            return (
              <div key={id} className="flex items-center justify-between px-4 py-2 pl-10">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm truncate ${meta?.hidden ? 'text-gray-400 italic' : 'text-gray-700'}`}
                  >
                    {meta?.title ?? id}
                  </span>
                  {meta?.hidden && (
                    <span className="text-[10px] leading-none px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 shrink-0">
                      skrytá
                    </span>
                  )}
                  {changed && (
                    <span className="text-[10px] leading-none px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 shrink-0">
                      změna
                    </span>
                  )}
                </span>
                <Switch
                  state={enabled ? 'on' : 'off'}
                  onClick={() => onToggleService(id)}
                  disabled={disabled}
                  title={enabled ? 'Доступна — нажми чтобы скрыть' : 'Скрыта — нажми чтобы открыть'}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
