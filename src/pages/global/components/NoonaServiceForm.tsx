import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createMissingCombinations,
  getAllSubsets,
  getNoonaCategories,
  searchNoonaServices,
  type AddonInput,
  type CreateServiceResult,
  type ExistingAddonContext,
  type FullCombosResult,
  type ModifierInput,
  type NoonaCategory,
  type NoonaServiceItem,
} from '../fetch/noonaServices'
import { fetchExistingAddonGroup, saveBookingAddonGroup, type ExistingAddonGroupRecord } from '../fetch/strapiAddonGroups'

interface Row {
  id: number
  label: string
  priceDiff: string
}

let nextId = 1
const makeRow = (): Row => ({ id: nextId++, label: '', priceDiff: '' })

type Status = 'idle' | 'noona' | 'strapi' | 'done' | 'error'

export const NoonaServiceForm = () => {
  // --- Категории ---
  const [categories, setCategories] = useState<NoonaCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>('')

  useEffect(() => {
    getNoonaCategories().then(setCategories)
  }, [])

  // --- Поиск базовой услуги ---
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NoonaServiceItem[]>([])
  const [selectedService, setSelectedService] = useState<NoonaServiceItem | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // --- Варианты и дополнения ---
  const [addonRows, setAddonRows] = useState<Row[]>([makeRow()])
  const [modifierRows, setModifierRows] = useState<Row[]>([makeRow()])

  // --- Существующая группа из Strapi (для расчёта реальных кросс-комбо) ---
  const [existingGroup, setExistingGroup] = useState<ExistingAddonGroupRecord | null>(null)

  useEffect(() => {
    if (!selectedService) { setExistingGroup(null); return }
    fetchExistingAddonGroup(selectedService.id).then(setExistingGroup)
  }, [selectedService])

  // --- Состояние сабмита ---
  const [status, setStatus] = useState<Status>('idle')
  const [combosResult, setCombosResult] = useState<FullCombosResult | null>(null)
  const [strapiId, setStrapiId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Debounced поиск
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      const results = await searchNoonaServices(searchQuery)
      setSuggestions(results)
      setShowSuggestions(true)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Закрыть dropdown при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const validAddons = addonRows.filter((r) => r.label.trim())
  const validModifiers = modifierRows.filter((r) => r.label.trim())

  // --- Предпросмотр всех комбинаций ---
  const previewGroups = useMemo(() => {
    if (!selectedService || (validAddons.length === 0 && validModifiers.length === 0)) return null
    const base = selectedService
    const groups: { title: string; items: { name: string; price: number }[] }[] = []

    // Варианты без дополнений
    if (validAddons.length > 0) {
      groups.push({
        title: 'Варианты',
        items: validAddons.map((a) => ({
          name: `${base.title} ${a.label}`,
          price: base.price + Number(a.priceDiff || 0),
        })),
      })
    }

    if (validModifiers.length > 0) {
      const modSubsets = getAllSubsets(validModifiers)

      // База + дополнения
      groups.push({
        title: 'Базовая + дополнения',
        items: modSubsets.map((subset) => ({
          name: `${base.title} ${subset.map((m) => m.label).join(' ')}`,
          price: base.price + subset.reduce((s, m) => s + Number(m.priceDiff || 0), 0),
        })),
      })

      // Варианты + дополнения
      if (validAddons.length > 0) {
        const items: { name: string; price: number }[] = []
        for (const addon of validAddons) {
          for (const subset of modSubsets) {
            items.push({
              name: `${base.title} ${addon.label} ${subset.map((m) => m.label).join(' ')}`,
              price:
                base.price +
                Number(addon.priceDiff || 0) +
                subset.reduce((s, m) => s + Number(m.priceDiff || 0), 0),
            })
          }
        }
        groups.push({ title: 'Варианты + дополнения', items })
      }
    }

    return groups
  }, [selectedService, validAddons, validModifiers])

  const totalCombos = previewGroups?.reduce((s, g) => s + g.items.length, 0) ?? 0

  // --- Подсчёт реального кол-ва новых услуг в Noona (включая кросс-комбо с существующими) ---
  const toKeyLocal = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

  const comboStats = useMemo(() => {
    if (!selectedService || (validAddons.length === 0 && validModifiers.length === 0)) return null

    const existingModInputs: ModifierInput[] = (existingGroup?.modifiers ?? []).map((m) => ({
      label: m.label,
      priceDiff: m.price_diff,
    }))
    const allMods = [...existingModInputs, ...validModifiers]
    const formAddonLabels = new Set(validAddons.map((a) => a.label.trim()))
    const existingAddonContexts = (existingGroup?.addons ?? []).filter(
      (ea) => !formAddonLabels.has(ea.label),
    )
    const existingBaseKeys = new Set(
      (existingGroup?.base_modifier_results ?? []).map((r) => r.modifier_keys),
    )

    // fromForm = services that come directly from the current form inputs (matches totalCombos)
    // crossCount = extra services: cross-combos of new mods with existing mods,
    //              and cross-combos for existing addons that get new modifier entries
    let fromForm = validAddons.length
    let crossCount = 0
    let skippedCount = 0

    if (allMods.length > 0) {
      const allSubsets = getAllSubsets(allMods)
      // Keys of subsets that consist ONLY of new (form) modifiers
      const formModKeys = new Set(
        getAllSubsets(validModifiers).map((s) => s.map((m) => toKeyLocal(m.label)).sort().join(',')),
      )

      // Base × modifier subsets
      for (const subset of allSubsets) {
        const key = subset.map((m) => toKeyLocal(m.label)).sort().join(',')
        if (existingBaseKeys.has(key)) skippedCount++
        else if (formModKeys.has(key)) fromForm++
        else crossCount++ // contains at least one existing mod key
      }

      // Form addons × all modifier subsets
      for (let i = 0; i < validAddons.length; i++) {
        for (const subset of allSubsets) {
          const key = subset.map((m) => toKeyLocal(m.label)).sort().join(',')
          if (formModKeys.has(key)) fromForm++
          else crossCount++
        }
      }

      // Existing addons × missing modifier subsets
      for (const ea of existingAddonContexts) {
        const existingMRKeys = new Set((ea.modifier_results ?? []).map((r) => r.modifier_keys))
        for (const subset of allSubsets) {
          const key = subset.map((m) => toKeyLocal(m.label)).sort().join(',')
          if (existingMRKeys.has(key)) skippedCount++
          else crossCount++
        }
      }
    }

    return { fromForm, crossCount, skippedCount, newCount: fromForm + crossCount, hasCrossCombos: crossCount > 0 }
  }, [selectedService, existingGroup, validAddons, validModifiers])

  // --- Submit ---
  const handleSubmit = async () => {
    if (!selectedService) {
      setErrorMsg('Выберите базовую услугу')
      return
    }
    if (validAddons.length === 0 && validModifiers.length === 0) {
      setErrorMsg('Добавьте хотя бы один вариант или дополнение')
      return
    }

    setStatus('noona')
    setErrorMsg(null)
    setCombosResult(null)
    setStrapiId(null)

    const newAddonInputs: AddonInput[] = validAddons.map((r) => ({
      label: r.label.trim(),
      priceDiff: Number(r.priceDiff || 0),
    }))
    const newModifierInputs: ModifierInput[] = validModifiers.map((r) => ({
      label: r.label.trim(),
      priceDiff: Number(r.priceDiff || 0),
    }))

    // Fetch existing record to build complete context for cross-combos
    const existing = await fetchExistingAddonGroup(selectedService.id)

    // All modifiers = existing (from Strapi) + new (from form)
    const existingModInputs: ModifierInput[] = (existing?.modifiers ?? []).map((m) => ({
      label: m.label,
      priceDiff: m.price_diff,
    }))
    const allModifiers: ModifierInput[] = [...existingModInputs, ...newModifierInputs]

    // Existing addons — skip those re-submitted via the form (treat as new)
    const newAddonLabels = new Set(newAddonInputs.map((a) => a.label))
    const existingAddonContexts: ExistingAddonContext[] = (existing?.addons ?? [])
      .filter((ea) => !newAddonLabels.has(ea.label))
      .map((ea) => ({
        label: ea.label,
        priceDiff: ea.price_diff,
        existingModResultKeys: new Set((ea.modifier_results ?? []).map((r) => r.modifier_keys)),
      }))

    const existingBaseModResultKeys = new Set(
      (existing?.base_modifier_results ?? []).map((r) => r.modifier_keys),
    )

    const combos = await createMissingCombinations(
      selectedService.title,
      selectedService.duration,
      selectedService.price,
      newAddonInputs,
      existingAddonContexts,
      allModifiers,
      existingBaseModResultKeys,
      categoryId || undefined,
    )
    setCombosResult(combos)

    const allResults: CreateServiceResult[] = [
      ...combos.addonResults.map((c) => c.result),
      ...combos.baseModifierResults.map((c) => c.result),
      ...combos.addonModifierResults.map((c) => c.result),
    ]

    if (allResults.some((r) => r.status === 'error')) {
      setStatus('error')
      setErrorMsg('Не все комбо созданы в Noona. Strapi не обновлён.')
      return
    }

    setStatus('strapi')
    try {
      const saved = await saveBookingAddonGroup({
        baseNoonaId: selectedService.id,
        baseTitle: selectedService.title,
        basePrice: selectedService.price,
        addons: newAddonInputs,
        modifiers: newModifierInputs,
        combos,
      })
      setStrapiId(String(saved.id))
      setStatus('done')
    } catch (err) {
      type ApiErr = { message?: string; response?: { data?: { error?: { message?: string } } } }
      const e = err as ApiErr
      const msg = e?.response?.data?.error?.message ?? e?.message ?? 'Ошибка'
      setErrorMsg(`Noona: OK. Strapi: ${msg}`)
      setStatus('error')
    }
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const isSubmitting = status === 'noona' || status === 'strapi'

  // --- Рендер секции строк (addons или modifiers) ---
  const renderRowSection = (
    title: string,
    description: string,
    rows: Row[],
    setRows: React.Dispatch<React.SetStateAction<Row[]>>,
    placeholder: string,
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
      <div className="mb-4">
        <span className="font-semibold text-gray-600 text-sm">{title}</span>
        <span className="ml-2 text-xs text-gray-400">{description}</span>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.id} className="flex gap-3 items-end">
            <div className="flex-1">
              {idx === 0 && (
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  Название
                </label>
              )}
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                  )
                }
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              {idx === 0 && (
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  +Kč
                </label>
              )}
              <input
                type="number"
                value={row.priceDiff}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id ? { ...r, priceDiff: e.target.value } : r,
                    ),
                  )
                }
                min={0}
                placeholder="200"
                className="w-[100px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              disabled={rows.length === 1}
              className="pb-2 text-red-400 hover:text-red-600 text-sm transition-colors disabled:opacity-30"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setRows((prev) => [...prev, makeRow()])}
        className="mt-3 text-sm text-primary font-semibold hover:underline"
      >
        + Добавить
      </button>
    </div>
  )

  // --- Рендер результатов ---
  const renderResults = () => {
    if (!combosResult) return null
    const sections = [
      {
        title: 'Варианты',
        items: combosResult.addonResults.map((c) => c.result),
      },
      {
        title: 'Базовая + дополнения',
        items: combosResult.baseModifierResults.map((c) => c.result),
      },
      {
        title: 'Варианты + дополнения',
        items: combosResult.addonModifierResults.map((c) => c.result),
      },
    ].filter((s) => s.items.length > 0)

    return (
      <div className="mt-6">
        <h3 className="text-base font-bold text-gray-800 mb-3">Результат Noona</h3>
        {sections.map((section, si) => (
          <div key={si} className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.items.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    r.status === 'ok'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-gray-800">{r.title}</span>
                    {r.status === 'ok' ? (
                      <span className="ml-3 text-sm text-gray-500 font-mono">{r.id}</span>
                    ) : (
                      <span className="ml-3 text-sm text-red-500">{r.error}</span>
                    )}
                  </div>
                  {r.status === 'ok' && (
                    <button
                      onClick={() => copyId(r.id)}
                      className="text-xs text-primary font-semibold hover:underline ml-4 shrink-0"
                    >
                      {copied === r.id ? '✓' : 'Копировать'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {status === 'done' && strapiId && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Strapi booking-addon-group сохранён (ID: {strapiId})
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Базовая услуга */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
        <span className="font-semibold text-gray-600 text-sm">Базовая услуга</span>

        <div className="mt-4" ref={searchRef}>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Найти в Noona
          </label>

          {selectedService ? (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="flex-1">
                <span className="font-semibold text-gray-800">{selectedService.title}</span>
                <span className="ml-3 text-sm text-gray-500">
                  {selectedService.duration} мин · {selectedService.price} Kč
                </span>
                <span className="ml-3 text-xs text-gray-400 font-mono">{selectedService.id}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedService(null)
                  setSearchQuery('')
                  setSuggestions([])
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
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Gel lak..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((svc) => (
                    <button
                      key={svc.id}
                      onMouseDown={() => {
                        setSelectedService(svc)
                        setSearchQuery(svc.title)
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-800">{svc.title}</span>
                      <span className="ml-2 text-gray-400">
                        {svc.duration} мин · {svc.price} Kč
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && suggestions.length === 0 && searchQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
                  Ничего не найдено
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Категория в Noona */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
        <span className="font-semibold text-gray-600 text-sm">Категория в Noona</span>
        <p className="text-xs text-gray-400 mt-0.5">Все скрытые комбо-услуги будут добавлены в эту группу</p>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">— Без категории —</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.title}
            </option>
          ))}
        </select>
      </div>

      {/* Варианты (addons) — radio-кнопки в клиенте, каждый = отдельная услуга в Noona */}
      {renderRowSection(
        'Варианты (addons)',
        '— выбирается один, каждый = отдельная услуга в Noona',
        addonRows,
        setAddonRows,
        '+ Francouzská manikúra',
      )}

      {/* Дополнения (modifiers) — чекбоксы в клиенте, добавляются к базе И к каждому варианту */}
      {renderRowSection(
        'Дополнения (modifiers)',
        '— чекбоксы, добавляются к базе и к каждому варианту',
        modifierRows,
        setModifierRows,
        'Posílení nehtů',
      )}

      {/* Предпросмотр */}
      {previewGroups && totalCombos > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Будет создано в Noona ({totalCombos} комбо)
          </p>
          {previewGroups.map((group, gi) => (
            <div key={gi} className={gi < previewGroups.length - 1 ? 'mb-3' : ''}>
              <p className="text-xs text-gray-400 mb-1">{group.title}</p>
              <ul className="space-y-1">
                {group.items.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-gray-400">{item.price} Kč</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {comboStats?.hasCrossCombos && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
          <span className="font-semibold">
            Noona: {comboStats.fromForm} из формы + {comboStats.crossCount} кросс-комбо = {comboStats.newCount} новых
          </span>
          {comboStats.skippedCount > 0 && (
            <span className="text-amber-600 ml-2">({comboStats.skippedCount} уже есть, пропускаются)</span>
          )}
          <br />
          <span className="text-xs text-amber-600">
            Кросс-комбо: новые модификаторы × существующие данные
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {status === 'noona'
          ? 'Создаём в Noona...'
          : status === 'strapi'
            ? 'Сохраняем в Strapi...'
            : `Создать (${comboStats?.newCount ?? totalCombos} в Noona) + сохранить в Strapi`}
      </button>

      {renderResults()}
    </div>
  )
}
