import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoonaCategory, NoonaEventType, Scope } from '../../fetch/priceIncrease'

interface Props {
  eventTypes: NoonaEventType[]
  categories: NoonaCategory[]
  scope: Scope | null
  onChange: (scope: Scope | null) => void
}

type ScopeKind = 'service' | 'category' | 'global'

export const ScopeSelector = ({ eventTypes, categories, scope, onChange }: Props) => {
  const [kind, setKind] = useState<ScopeKind>('service')

  // Service search (only public/non-hidden services)
  const publicServices = useMemo(() => eventTypes.filter((s) => !s.hidden), [eventTypes])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return publicServices.slice(0, 15)
    return publicServices
      .filter((s) => s.title.toLowerCase().includes(q))
      .slice(0, 20)
  }, [publicServices, searchQuery])

  const selectedService = publicServices.find((s) => s.id === selectedServiceId)

  // Category
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  // Sync up to parent
  useEffect(() => {
    if (kind === 'service') {
      onChange(selectedServiceId ? { kind: 'service', baseNoonaId: selectedServiceId } : null)
    } else if (kind === 'category') {
      onChange(selectedCategoryId ? { kind: 'category', categoryId: selectedCategoryId } : null)
    } else {
      onChange({ kind: 'global' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, selectedServiceId, selectedCategoryId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const radioClass = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
      active
        ? 'bg-primary text-white border-primary'
        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
    }`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
      <span className="font-semibold text-gray-600 text-sm">Что повышаем</span>

      <div className="mt-3 flex gap-2">
        <button onClick={() => setKind('service')} className={radioClass(kind === 'service')}>
          Одна услуга
        </button>
        <button onClick={() => setKind('category')} className={radioClass(kind === 'category')}>
          Категория Noona
        </button>
        <button onClick={() => setKind('global')} className={radioClass(kind === 'global')}>
          Всё глобально
        </button>
      </div>

      {kind === 'service' && (
        <div className="mt-4" ref={searchRef}>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Базовая услуга
          </label>

          {selectedService ? (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="flex-1">
                <span className="font-semibold text-gray-800">{selectedService.title}</span>
                <span className="ml-3 text-sm text-gray-500">{selectedService.price} Kč</span>
              </div>
              <button
                onClick={() => {
                  setSelectedServiceId('')
                  setSearchQuery('')
                }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Gel lak..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {suggestions.map((svc) => (
                    <button
                      key={svc.id}
                      onMouseDown={() => {
                        setSelectedServiceId(svc.id)
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-800">{svc.title}</span>
                      <span className="ml-2 text-gray-400">{svc.price} Kč</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Изменятся: эта услуга в Noona + все её скрытые комбо-варианты + соответствующий
            addon-group в Strapi + offerings.
          </p>
        </div>
      )}

      {kind === 'category' && (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Категория Noona
          </label>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">— Выберите категорию —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.serviceIds.length})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Изменятся: все услуги в категории (включая hidden combo) + связанные addon-group +
            offerings.
          </p>
        </div>
      )}

      {kind === 'global' && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Будут обновлены все услуги:</span> {eventTypes.length}{' '}
          event_types в Noona + все addon-groups в Strapi + все offerings (где title совпадает).
          <br />
          <span className="text-xs text-amber-700 mt-1 inline-block">
            История смен, зарплат, pricelist, hardcoded JSON-LD на /service/* — не затрагиваются.
          </span>
        </div>
      )}

      {scope && (
        <div className="mt-3 text-xs text-gray-500">
          <span className="font-semibold">Scope:</span>{' '}
          {scope.kind === 'service' && `1 базовая услуга`}
          {scope.kind === 'category' &&
            categories.find((c) => c.id === scope.categoryId)?.title}
          {scope.kind === 'global' && 'все услуги'}
        </div>
      )}
    </div>
  )
}
