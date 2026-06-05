import { useEffect, useMemo, useRef, useState } from 'react'

import { PlanPreview, ResultsTable, ServiceEditor, ServiceSelector } from '../components/manage'
import {
  applyAllOps,
  buildDeleteAddonPlan,
  buildDeleteModifierPlan,
  buildDeleteServicePlan,
  buildDescriptionPlan,
  buildDurationEditPlan,
  buildPriceEditPlan,
  buildRenamePlan,
  buildReorderPlan,
  fetchAllAddonGroups,
  fetchEventTypesWithConnections,
  fetchFutureBookedTitles,
  fetchJuniorMapsForService,
  fetchOfferingsForService,
  type JuniorMapRecord,
  type DescriptionTarget,
  type ManagedEventType,
  type OpResult,
  type PlannedManageOp,
  type PriceTarget,
  type RenameTarget,
  type StrapiAddonGroup,
  type StrapiOffering,
} from '../fetch/manageServices'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export default function ManageTab() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groups, setGroups] = useState<StrapiAddonGroup[]>([])
  const [eventTypes, setEventTypes] = useState<ManagedEventType[]>([])
  // offerings / juniorMaps hold ONLY the currently-selected service's rows (fetched on
  // select via a $startsWith filter), not the whole ~2.4k offerings / ~1k maps tables.
  const [offerings, setOfferings] = useState<StrapiOffering[]>([])
  const [juniorMaps, setJuniorMaps] = useState<JuniorMapRecord[]>([])
  const [serviceDataLoading, setServiceDataLoading] = useState(false)
  const selectSeq = useRef(0) // guards against out-of-order service-data fetches
  // Titles of services with FUTURE bookings — excluded from hard-delete (hidden instead).
  // Fetched LAZILY (a full year of Noona events is heavy) only when a delete is started,
  // so the common edit path (price/duration/rename) never pays for it. null = unavailable
  // → delete plans fail safe to hide. `futureBookedLoaded` distinguishes "not fetched yet".
  const [futureBooked, setFutureBooked] = useState<Set<string> | null>(null)
  const [futureBookedLoaded, setFutureBookedLoaded] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  // Upfront load is cheap: addon-groups (the selector) + the full Noona event_types list
  // (one ~0.3s request). The heavy per-service data (offerings/junior-maps) is fetched
  // only when a service is selected. Returns fresh groups so callers can re-select.
  const loadAll = async (): Promise<StrapiAddonGroup[]> => {
    setLoadStatus('loading')
    setLoadError(null)
    setFutureBookedLoaded(false) // invalidate cached future-bookings → next delete refetches fresh
    try {
      const [grp, ets] = await Promise.all([
        fetchAllAddonGroups(),
        fetchEventTypesWithConnections(),
      ])
      setGroups(grp)
      setEventTypes(ets)
      setLoadStatus('ready')
      setDataVersion((v) => v + 1)
      return grp
    } catch (err) {
      setLoadError((err as { message?: string })?.message ?? 'Ошибка загрузки')
      setLoadStatus('error')
      return []
    }
  }

  // Load only the selected service's offerings + junior-maps (scoped by base title).
  // Guarded by selectSeq so a slow earlier fetch can't overwrite a newer selection.
  const [serviceDataError, setServiceDataError] = useState<string | null>(null)
  const loadServiceData = async (group: StrapiAddonGroup) => {
    const seq = ++selectSeq.current
    setServiceDataLoading(true)
    setServiceDataError(null)
    setOfferings([])
    setJuniorMaps([])
    try {
      const [offs, jm] = await Promise.all([
        fetchOfferingsForService(group.title),
        fetchJuniorMapsForService(group.title),
      ])
      if (seq !== selectSeq.current) return // superseded by a newer selection
      setOfferings(offs)
      setJuniorMaps(jm)
    } catch (err) {
      if (seq !== selectSeq.current) return
      setServiceDataError((err as { message?: string })?.message ?? 'Ошибка загрузки данных услуги')
    } finally {
      if (seq === selectSeq.current) setServiceDataLoading(false)
    }
  }

  // Fetch the future-booked titles on demand (first delete), then cache for the session.
  const ensureFutureBooked = async (): Promise<Set<string> | null> => {
    if (futureBookedLoaded) return futureBooked
    const fb = await fetchFutureBookedTitles()
    setFutureBooked(fb)
    setFutureBookedLoaded(true)
    return fb
  }

  useEffect(() => {
    loadAll()
  }, [])

  const etMap = useMemo(() => new Map(eventTypes.map((et) => [et.id, et])), [eventTypes])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedGroup = useMemo(
    () => groups.find((g) => g.documentId === selectedId) ?? null,
    [groups, selectedId],
  )

  const [plan, setPlan] = useState<PlannedManageOp[]>([])
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applying'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<OpResult[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  const resetPlanState = () => {
    setPlan([])
    setResults([])
    setProgress({ done: 0, total: 0 })
  }

  const selectGroup = (g: StrapiAddonGroup) => {
    setSelectedId(g.documentId)
    resetPlanState()
    loadServiceData(g)
  }

  // ── Plan builders wired to editor ───────────────────────────────────────────
  const onPriceEdit = (target: PriceTarget, newValue: number) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildPriceEditPlan({ group: selectedGroup, target, newValue, eventTypes: etMap, offerings, juniorMaps }))
  }
  const onDurationEdit = (target: PriceTarget, newValue: number) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildDurationEditPlan({ group: selectedGroup, target, newValue, eventTypes: etMap, juniorMaps }))
  }
  const onRename = (target: RenameTarget, newName: string) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildRenamePlan({ group: selectedGroup, target, newName, eventTypes: etMap, offerings, juniorMaps }))
  }
  const onReorder = (kind: 'addon' | 'modifier', orderedIds: string[]) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildReorderPlan(selectedGroup, kind, orderedIds))
  }
  const onSaveDescription = (target: DescriptionTarget, description: string) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildDescriptionPlan(selectedGroup, target, description))
  }
  const onDeleteAddon = async (label: string) => {
    if (!selectedGroup) return
    setResults([])
    const fb = await ensureFutureBooked()
    setPlan(buildDeleteAddonPlan(selectedGroup, label, etMap, juniorMaps, fb))
  }
  const onDeleteModifier = async (key: string) => {
    if (!selectedGroup) return
    setResults([])
    const fb = await ensureFutureBooked()
    setPlan(buildDeleteModifierPlan(selectedGroup, key, etMap, juniorMaps, fb))
  }
  const onDeleteService = async () => {
    if (!selectedGroup) return
    setResults([])
    const fb = await ensureFutureBooked()
    setPlan(buildDeleteServicePlan({ group: selectedGroup, eventTypes: etMap, juniorMaps, futureBooked: fb }))
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  const runOps = async (ops: PlannedManageOp[]) => {
    setProgress({ done: 0, total: ops.length })
    const res = await applyAllOps(ops, (done, total) => setProgress({ done, total }))
    const grp = await loadAll() // refresh groups + Noona so editor reflects new state
    // re-fetch the still-selected service's offerings/junior-maps from the fresh groups
    const sel = grp.find((g) => g.documentId === selectedId)
    if (sel) await loadServiceData(sel)
    return res
  }

  const handleApply = async () => {
    if (plan.length === 0) return
    if (!confirm(`Применить ${plan.length} операций? Изменит Noona и Strapi.`)) return
    setApplyStatus('applying')
    const res = await runOps(plan)
    setResults(res)
    setPlan([])
    setApplyStatus('idle')
  }

  const handleRetryFailed = async () => {
    const failed = results.filter((r) => r.status === 'error').map((r) => r.planned)
    if (failed.length === 0) return
    setIsRetrying(true)
    const res = await runOps(failed)
    const byKey = new Map(res.map((r) => [r.planned.key, r]))
    setResults((prev) => prev.map((r) => byKey.get(r.planned.key) ?? r))
    setIsRetrying(false)
  }

  const busy = applyStatus === 'applying' || isRetrying

  return (
    <>
      <h3 className="text-2xl font-bold text-gray-800 mb-2">Správa služeb</h3>
      <p className="text-sm text-gray-500 mb-6">
        Переименование, удаление, смена цены и времени услуг, вариантов и дополнений. Изменения
        проходят по Noona (база + все combo), Strapi addon-group, offer (по названию) и junior-копиям.
        История смен/зарплат не трогается.
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
            Загружено: {groups.length} addon-групп, {eventTypes.length} Noona-услуг
            {selectedGroup && !serviceDataLoading && (
              <> · по услуге: {offerings.length} offer, {juniorMaps.length} junior-маппингов</>
            )}
          </div>

          <ServiceSelector
            groups={groups}
            selectedId={selectedId}
            onSelect={selectGroup}
            disabled={busy}
          />

          {selectedGroup && serviceDataLoading && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-sm text-gray-500 mt-4">
              Загружаем данные услуги (offer + junior-копии)…
            </div>
          )}

          {selectedGroup && !serviceDataLoading && serviceDataError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mt-4">
              <p className="text-sm text-red-700 font-semibold">Не удалось загрузить данные услуги</p>
              <p className="text-xs text-red-600 mt-1">{serviceDataError}</p>
              <button
                onClick={() => loadServiceData(selectedGroup)}
                className="mt-3 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
              >
                Повторить
              </button>
            </div>
          )}

          {selectedGroup && !serviceDataLoading && !serviceDataError && (
            <ServiceEditor
              key={`${selectedGroup.documentId}:${dataVersion}`}
              group={selectedGroup}
              baseDuration={etMap.get(selectedGroup.base_noona_id)?.duration ?? 0}
              onPriceEdit={onPriceEdit}
              onDurationEdit={onDurationEdit}
              onRename={onRename}
              onReorder={onReorder}
              onSaveDescription={onSaveDescription}
              onDeleteAddon={onDeleteAddon}
              onDeleteModifier={onDeleteModifier}
              onDeleteService={onDeleteService}
              disabled={busy}
            />
          )}

          <PlanPreview
            ops={plan}
            onApply={handleApply}
            onCancel={resetPlanState}
            applying={applyStatus === 'applying'}
            progress={progress}
          />

          <ResultsTable results={results} onRetryFailed={handleRetryFailed} isRetrying={isRetrying} />
        </>
      )}
    </>
  )
}
