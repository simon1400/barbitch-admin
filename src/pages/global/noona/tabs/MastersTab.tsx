import { useEffect, useMemo, useState } from 'react'

import { CategoryRow, MasterSelector } from '../components/masters'
import {
  buildEnabledMap,
  buildPrefsPayload,
  downloadPrefsBackup,
  fetchAllNoonaCategoriesWithServices,
  fetchEmployee,
  fetchEmployees,
  fetchServiceMeta,
  saveEmployeePrefs,
  type Employee,
  type NoonaCategory,
  type SaveResult,
  type ServiceMeta,
} from '../fetch/masterServices'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export default function MastersTab() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<NoonaCategory[]>([])
  const [serviceMeta, setServiceMeta] = useState<Map<string, ServiceMeta>>(new Map())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enabledMap, setEnabledMap] = useState<Map<string, boolean>>(new Map())
  const [originalMap, setOriginalMap] = useState<Map<string, boolean>>(new Map())

  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)

  // Union of every category serviceId that we actually know (present in event_types),
  // deduped — these are the services this tab manages.
  const managedIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of categories) for (const id of c.serviceIds) if (serviceMeta.has(id)) set.add(id)
    return [...set]
  }, [categories, serviceMeta])

  const loadAll = async () => {
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const [emps, cats, meta] = await Promise.all([
        fetchEmployees(),
        fetchAllNoonaCategoriesWithServices(),
        fetchServiceMeta(),
      ])
      setEmployees(emps)
      setCategories(cats)
      setServiceMeta(meta)
      setLoadStatus('ready')
    } catch (err) {
      setLoadError((err as { message?: string })?.message ?? 'Ошибка загрузки')
      setLoadStatus('error')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId],
  )

  // (re)build the working state whenever the selected master or the managed set changes
  useEffect(() => {
    if (!selectedEmployee || managedIds.length === 0) return
    const map = buildEnabledMap(selectedEmployee, managedIds)
    setEnabledMap(new Map(map))
    setOriginalMap(new Map(map))
    setSaveResult(null)
  }, [selectedEmployee, managedIds])

  const selectMaster = (id: string) => {
    setSelectedId(id)
    setSaveResult(null)
  }

  const toggleService = (id: string) => {
    setEnabledMap((prev) => {
      const next = new Map(prev)
      next.set(id, !next.get(id))
      return next
    })
    setSaveResult(null)
  }

  const toggleCategory = (serviceIds: string[], nextEnabled: boolean) => {
    setEnabledMap((prev) => {
      const next = new Map(prev)
      for (const id of serviceIds) next.set(id, nextEnabled)
      return next
    })
    setSaveResult(null)
  }

  const changedCount = useMemo(
    () => managedIds.filter((id) => enabledMap.get(id) !== originalMap.get(id)).length,
    [managedIds, enabledMap, originalMap],
  )
  const enabledCount = useMemo(
    () => managedIds.filter((id) => enabledMap.get(id)).length,
    [managedIds, enabledMap],
  )

  const resetChanges = () => {
    setEnabledMap(new Map(originalMap))
    setSaveResult(null)
  }

  const handleSave = async () => {
    if (!selectedEmployee || changedCount === 0) return
    if (
      !confirm(
        `Сохранить доступность услуг для «${selectedEmployee.name}»?\n` +
          `Изменено: ${changedCount}. Сначала скачается бэкап текущих prefs.`,
      )
    )
      return

    setSaving(true)
    setSaveResult(null)
    try {
      // Build on FRESH server prefs (not the stale list snapshot) + back them up first.
      const fresh = await fetchEmployee(selectedEmployee.id)
      downloadPrefsBackup(fresh)
      const payload = buildPrefsPayload(fresh, managedIds, enabledMap)
      const res = await saveEmployeePrefs(selectedEmployee.id, payload)
      setSaveResult(res)
      if (res.status === 'ok') {
        // Commit working state as the new baseline + refresh employee list prefs.
        setOriginalMap(new Map(enabledMap))
        await loadAll()
      }
    } catch (err) {
      setSaveResult({
        status: 'error',
        count: 0,
        error: (err as { message?: string })?.message ?? 'Ошибка',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h3 className="text-2xl font-bold text-gray-800 mb-2">Mistři</h3>
      <p className="text-sm text-gray-500 mb-6">
        Управление тем, какие услуги открыты мастеру для онлайн-записи. Переключатель открывает/скрывает
        целую категорию или отдельную услугу. Модель Noona: услуга доступна по умолчанию — скрытие
        выставляет <code className="text-xs bg-gray-100 px-1 rounded">skip_calendar=true</code>, открытие —{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">false</code>. Перед сохранением скачивается
        бэкап prefs.
      </p>

      {loadStatus === 'loading' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Загружаем мастеров и услуги из Noona…
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
            Загружено: {employees.length} мастеров, {categories.length} категорий, {managedIds.length}{' '}
            услуг
          </div>

          <MasterSelector
            employees={employees}
            selectedId={selectedId}
            onSelect={selectMaster}
            disabled={saving}
          />

          {selectedEmployee && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-sm text-gray-600">
                  Доступно <span className="font-semibold text-gray-800">{enabledCount}</span> из{' '}
                  {managedIds.length}
                  {changedCount > 0 && (
                    <span className="ml-2 text-amber-600 font-semibold">· изменено {changedCount}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPrefsBackup(selectedEmployee)}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 disabled:opacity-60"
                  >
                    Скачать бэкап prefs
                  </button>
                  {changedCount > 0 && (
                    <button
                      type="button"
                      onClick={resetChanges}
                      disabled={saving}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 disabled:opacity-60"
                    >
                      Сбросить
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || changedCount === 0}
                    className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Сохраняем…' : `Сохранить (${changedCount})`}
                  </button>
                </div>
              </div>

              {saveResult && (
                <div
                  className={`mb-4 rounded-xl border p-4 text-sm ${
                    saveResult.status === 'ok'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {saveResult.status === 'ok'
                    ? `Сохранено: записано ${saveResult.count} prefs в Noona.`
                    : `Ошибка сохранения: ${saveResult.error}`}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {categories.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    serviceMeta={serviceMeta}
                    enabledMap={enabledMap}
                    originalMap={originalMap}
                    onToggleService={toggleService}
                    onToggleCategory={toggleCategory}
                    disabled={saving}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
