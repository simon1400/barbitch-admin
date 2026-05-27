import { useEffect, useMemo, useState } from 'react'
import {
  PreviewTable,
  ResultsTable,
  ScopeSelector,
} from '../../components/priceIncrease'
import {
  applyAllChanges,
  buildPlan,
  fetchAllAddonGroups,
  fetchAllNoonaCategoriesWithServices,
  fetchAllNoonaEventTypes,
  fetchAllOfferings,
  type ApplyResult,
  type NoonaCategory,
  type NoonaEventType,
  type Scope,
  type StrapiAddonGroup,
  type StrapiOffering,
} from '../../fetch/priceIncrease'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type ApplyStatus = 'idle' | 'applying' | 'done'

export default function PriceIncreaseTab() {
  // ── Source data ───────────────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [eventTypes, setEventTypes] = useState<NoonaEventType[]>([])
  const [categories, setCategories] = useState<NoonaCategory[]>([])
  const [addonGroups, setAddonGroups] = useState<StrapiAddonGroup[]>([])
  const [offerings, setOfferings] = useState<StrapiOffering[]>([])

  const loadAll = async () => {
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const [ets, cats, ags, offs] = await Promise.all([
        fetchAllNoonaEventTypes(),
        fetchAllNoonaCategoriesWithServices(),
        fetchAllAddonGroups(),
        fetchAllOfferings(),
      ])
      setEventTypes(ets)
      setCategories(cats)
      setAddonGroups(ags)
      setOfferings(offs)
      setLoadStatus('ready')
    } catch (err) {
      const e = err as { message?: string }
      setLoadError(e?.message ?? 'Ошибка загрузки данных')
      setLoadStatus('error')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ── Form state ────────────────────────────────────────────────────────────
  const [scope, setScope] = useState<Scope | null>(null)
  const [percentStr, setPercentStr] = useState('10')
  const percent = Number(percentStr) || 0

  // ── Plan ──────────────────────────────────────────────────────────────────
  const plan = useMemo(() => {
    if (!scope || loadStatus !== 'ready') return []
    return buildPlan({ scope, percent, eventTypes, categories, addonGroups, offerings })
  }, [scope, percent, eventTypes, categories, addonGroups, offerings, loadStatus])

  // ── Apply ─────────────────────────────────────────────────────────────────
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ApplyResult[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  const handleApply = async () => {
    if (plan.length === 0) return
    if (!confirm(`Применить ${plan.length} изменений? Это нельзя откатить.`)) return
    setApplyStatus('applying')
    setProgress({ done: 0, total: plan.length })
    setResults([])
    const res = await applyAllChanges(plan, (done, total) => setProgress({ done, total }))
    setResults(res)
    setApplyStatus('done')
    // Refresh source data so subsequent plans use new prices
    loadAll()
  }

  const handleRetryFailed = async () => {
    const failedChanges = results.filter((r) => r.status === 'error').map((r) => r.change)
    if (failedChanges.length === 0) return
    setIsRetrying(true)
    setProgress({ done: 0, total: failedChanges.length })
    const newResults = await applyAllChanges(failedChanges, (done, total) =>
      setProgress({ done, total }),
    )
    // Merge: replace failed entries with retry results, keep successes
    const byKey = new Map(newResults.map((r) => [r.change.key, r]))
    setResults((prev) => prev.map((r) => byKey.get(r.change.key) ?? r))
    setIsRetrying(false)
    loadAll()
  }

  const isBusy = applyStatus === 'applying' || isRetrying

  return (
    <>
      <h3 className="text-2xl font-bold text-gray-800 mb-2">Повышение цен</h3>
      <p className="text-sm text-gray-500 mb-6">
        Пропорционально изменяет цены в Noona, Strapi addon-groups и offerings. История смен,
        зарплат, pricelist и JSON-LD не затрагиваются.
      </p>

      {loadStatus === 'loading' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Загружаем данные из Noona и Strapi…
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm text-red-700 font-semibold">Ошибка загрузки</p>
          <p className="text-xs text-red-600 mt-1">{loadError}</p>
          <button
            onClick={loadAll}
            className="mt-3 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
          >
            Повторить
          </button>
        </div>
      )}

      {loadStatus === 'ready' && (
        <>
          <div className="text-xs text-gray-400 mb-4">
            Загружено: {eventTypes.length} Noona-услуг, {categories.length} категорий,{' '}
            {addonGroups.length} addon-групп, {offerings.length} offerings
          </div>

          <ScopeSelector
            eventTypes={eventTypes}
            categories={categories}
            scope={scope}
            onChange={setScope}
          />

          {/* Percent input */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
            <span className="font-semibold text-gray-600 text-sm">Процент изменения</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                value={percentStr}
                onChange={(e) => setPercentStr(e.target.value)}
                step="0.5"
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <span className="text-sm text-gray-500">%</span>
              <span className="text-xs text-gray-400 ml-4">
                Положительное — повышение, отрицательное — снижение. Округление до целого: 1090 ×
                1.1 = 1199
              </span>
            </div>
          </div>

          <PreviewTable changes={plan} />

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleApply}
              disabled={isBusy || plan.length === 0}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {applyStatus === 'applying'
                ? `Применяем… (${progress.done}/${progress.total})`
                : `Применить (${plan.length})`}
            </button>
            {isRetrying && (
              <span className="text-sm text-gray-500">
                Повтор {progress.done}/{progress.total}…
              </span>
            )}
          </div>

          <ResultsTable
            results={results}
            onRetryFailed={handleRetryFailed}
            isRetrying={isRetrying}
          />
        </>
      )}
    </>
  )
}
