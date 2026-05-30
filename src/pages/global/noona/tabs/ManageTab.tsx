import { useEffect, useMemo, useState } from 'react'

import { PlanPreview, ResultsTable, ServiceEditor, ServiceSelector } from '../components/manage'
import {
  applyAllOps,
  buildDeleteAddonPlan,
  buildDeleteModifierPlan,
  buildDeleteServicePlan,
  buildPriceEditPlan,
  buildRenamePlan,
  fetchAllAddonGroups,
  fetchAllOfferings,
  fetchEventTypesWithConnections,
  fetchFutureBookedTitles,
  fetchJuniorMaps,
  type JuniorMapRecord,
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
  const [offerings, setOfferings] = useState<StrapiOffering[]>([])
  const [juniorMaps, setJuniorMaps] = useState<JuniorMapRecord[]>([])
  // Titles of services with FUTURE bookings — excluded from hard-delete (hidden instead).
  // null = booking data unavailable → delete plans fail safe to hide.
  const [futureBooked, setFutureBooked] = useState<Set<string> | null>(null)
  const [dataVersion, setDataVersion] = useState(0)

  const loadAll = async () => {
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const [grp, ets, offs, jm, fb] = await Promise.all([
        fetchAllAddonGroups(),
        fetchEventTypesWithConnections(),
        fetchAllOfferings(),
        fetchJuniorMaps(),
        fetchFutureBookedTitles(),
      ])
      setGroups(grp)
      setEventTypes(ets)
      setOfferings(offs)
      setJuniorMaps(jm)
      setFutureBooked(fb)
      setLoadStatus('ready')
      setDataVersion((v) => v + 1)
    } catch (err) {
      setLoadError((err as { message?: string })?.message ?? 'Ошибка загрузки')
      setLoadStatus('error')
    }
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
  }

  // ── Plan builders wired to editor ───────────────────────────────────────────
  const onPriceEdit = (target: PriceTarget, newValue: number) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildPriceEditPlan({ group: selectedGroup, target, newValue, eventTypes: etMap, offerings, juniorMaps }))
  }
  const onRename = (target: RenameTarget, newName: string) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildRenamePlan({ group: selectedGroup, target, newName, eventTypes: etMap, offerings, juniorMaps }))
  }
  const onDeleteAddon = (label: string) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildDeleteAddonPlan(selectedGroup, label, etMap, juniorMaps, futureBooked))
  }
  const onDeleteModifier = (key: string) => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildDeleteModifierPlan(selectedGroup, key, etMap, juniorMaps, futureBooked))
  }
  const onDeleteService = () => {
    if (!selectedGroup) return
    setResults([])
    setPlan(buildDeleteServicePlan({ group: selectedGroup, eventTypes: etMap, juniorMaps, futureBooked }))
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  const runOps = async (ops: PlannedManageOp[]) => {
    setProgress({ done: 0, total: ops.length })
    const res = await applyAllOps(ops, (done, total) => setProgress({ done, total }))
    await loadAll() // refresh so editor + selector reflect new state
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
        Переименование, удаление и смена цены услуг, вариантов и дополнений. Изменения проходят по
        Noona (база + все combo), Strapi addon-group, offer (по названию) и junior-копиям. История
        смен/зарплат не трогается.
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
            Загружено: {groups.length} addon-групп, {eventTypes.length} Noona-услуг,{' '}
            {offerings.length} offer, {juniorMaps.length} junior-маппингов
          </div>

          <ServiceSelector
            groups={groups}
            selectedId={selectedId}
            onSelect={selectGroup}
            disabled={busy}
          />

          {selectedGroup && (
            <ServiceEditor
              key={`${selectedGroup.documentId}:${dataVersion}`}
              group={selectedGroup}
              onPriceEdit={onPriceEdit}
              onRename={onRename}
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
