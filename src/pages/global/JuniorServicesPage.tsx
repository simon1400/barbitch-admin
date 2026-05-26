import { useEffect, useMemo, useState } from 'react'
import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { JUNIOR_DISCOUNT_PERCENT } from '../../constants/junior'
import {
  buildPlan,
  DEFAULT_EXCLUSION_PATTERNS,
  fetchAllNoonaCategories,
  fetchAllNoonaEventTypes,
  fetchExistingJuniorMaps,
  generateAll,
  type GenerateResult,
  type JuniorMap,
  type NoonaCategory,
  type NoonaEventType,
  type PlannedJunior,
} from './fetch/juniorServices'

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'generating' | 'done'

const autoSourceCategoryId = (cats: NoonaCategory[]): string => {
  const nehty = cats.find(
    (c) => c.title.toLowerCase().includes('nehty') && !c.title.toLowerCase().includes('junior'),
  )
  return nehty?.id ?? ''
}

const autoTargetCategoryId = (cats: NoonaCategory[]): string => {
  const junior = cats.find(
    (c) => c.title.toLowerCase().includes('junior') && c.title.toLowerCase().includes('nehty'),
  )
  return junior?.id ?? ''
}

export default function JuniorServicesPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [eventTypes, setEventTypes] = useState<NoonaEventType[]>([])
  const [categories, setCategories] = useState<NoonaCategory[]>([])
  const [existingMaps, setExistingMaps] = useState<JuniorMap[]>([])

  const [sourceCategoryId, setSourceCategoryId] = useState('')
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [exclusionsText, setExclusionsText] = useState(DEFAULT_EXCLUSION_PATTERNS.join(', '))

  const [plan, setPlan] = useState<PlannedJunior[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<GenerateResult[]>([])

  const loadAll = async () => {
    setStatus('loading')
    setError(null)
    try {
      const [ets, cats, maps] = await Promise.all([
        fetchAllNoonaEventTypes(),
        fetchAllNoonaCategories(),
        fetchExistingJuniorMaps(),
      ])
      setEventTypes(ets)
      setCategories(cats)
      setExistingMaps(maps)
      // Auto-detect categories on first load
      if (!sourceCategoryId) setSourceCategoryId(autoSourceCategoryId(cats))
      if (!targetCategoryId) setTargetCategoryId(autoTargetCategoryId(cats))
      setStatus('ready')
    } catch (err) {
      const e = err as { message?: string }
      setError(e?.message ?? 'Ошибка загрузки')
      setStatus('error')
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompute plan whenever inputs change
  const computedPlan = useMemo(() => {
    if (status !== 'ready' && status !== 'done' && status !== 'generating') return []
    if (!sourceCategoryId) return []
    const patterns = exclusionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return buildPlan({
      sourceCategoryId,
      eventTypes,
      categories,
      existingJuniorMaps: existingMaps,
      exclusionPatterns: patterns,
    })
  }, [sourceCategoryId, eventTypes, categories, existingMaps, exclusionsText, status])

  // Sync computedPlan into editable plan state when computedPlan changes
  useEffect(() => {
    setPlan(computedPlan)
  }, [computedPlan])

  const toggleSelected = (key: string) => {
    setPlan((prev) => prev.map((p) => (p.key === key ? { ...p, selected: !p.selected } : p)))
  }

  const toggleAll = (value: boolean) => {
    setPlan((prev) => prev.map((p) => (p.excluded ? p : { ...p, selected: value })))
  }

  const selectedCount = plan.filter((p) => p.selected && !p.excluded).length

  const handleGenerate = async () => {
    if (selectedCount === 0) return
    if (!targetCategoryId) {
      alert('Не выбрана целевая категория')
      return
    }
    if (!confirm(`Создать ${selectedCount} junior-копий в Noona? Цены -${JUNIOR_DISCOUNT_PERCENT}%.`))
      return
    setStatus('generating')
    setProgress({ done: 0, total: selectedCount })
    setResults([])
    const res = await generateAll(plan, targetCategoryId, eventTypes, (done, total) =>
      setProgress({ done, total }),
    )
    setResults(res)
    setStatus('done')
    // Refresh existing maps so newly-created items disappear from plan
    try {
      const maps = await fetchExistingJuniorMaps()
      setExistingMaps(maps)
    } catch {
      /* non-fatal */
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length
  const errCount = results.filter((r) => r.status === 'error').length

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.title.localeCompare(b.title, 'cs')),
    [categories],
  )

  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="pt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Junior služby</h2>
            <p className="text-sm text-gray-500 mb-6">
              Генерирует junior-копии Noona event_types с ценой -{JUNIOR_DISCOUNT_PERCENT}% и
              сохраняет маппинг senior → junior в Strapi.
            </p>

            {status === 'loading' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
                Загружаем данные из Noona и Strapi…
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-sm text-red-700 font-semibold">Ошибка</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <button
                  onClick={loadAll}
                  className="mt-3 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
                >
                  Повторить
                </button>
              </div>
            )}

            {(status === 'ready' || status === 'done' || status === 'generating') && (
              <>
                {/* Settings */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-600">
                      Источник (senior категория)
                    </span>
                    <select
                      value={sourceCategoryId}
                      onChange={(e) => setSourceCategoryId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      disabled={status === 'generating'}
                    >
                      <option value="">— выбрать —</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.serviceIds.length})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-600">
                      Цель (junior категория)
                    </span>
                    <select
                      value={targetCategoryId}
                      onChange={(e) => setTargetCategoryId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      disabled={status === 'generating'}
                    >
                      <option value="">— выбрать —</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">
                      Исключения (подстроки в title, через запятую)
                    </span>
                    <input
                      type="text"
                      value={exclusionsText}
                      onChange={(e) => setExclusionsText(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      disabled={status === 'generating'}
                    />
                    <span className="text-[11px] text-gray-400">
                      Услуги/комбо с этими словами в названии не получат junior-версию.
                    </span>
                  </label>
                </div>

                {/* Plan preview */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-700">
                      План: {plan.length} услуг ({selectedCount} выбрано)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAll(true)}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                        disabled={status === 'generating'}
                      >
                        Выбрать все
                      </button>
                      <button
                        onClick={() => toggleAll(false)}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                        disabled={status === 'generating'}
                      >
                        Снять все
                      </button>
                    </div>
                  </div>

                  {plan.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      {sourceCategoryId
                        ? 'Все услуги из этой категории уже имеют junior-копии или нет данных.'
                        : 'Выберите исходную категорию.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b">
                            <th className="py-2 w-8"></th>
                            <th className="py-2">Услуга</th>
                            <th className="py-2 text-right">Senior</th>
                            <th className="py-2 text-right">Junior</th>
                            <th className="py-2">Тип</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.map((p) => (
                            <tr
                              key={p.key}
                              className={`border-b last:border-b-0 ${p.excluded ? 'opacity-50' : ''}`}
                            >
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={p.selected && !p.excluded}
                                  onChange={() => toggleSelected(p.key)}
                                  disabled={p.excluded || status === 'generating'}
                                />
                              </td>
                              <td className="py-2">
                                {p.seniorTitle}
                                {p.exclusionReason && (
                                  <span className="ml-2 text-[10px] text-red-500">
                                    исключено ({p.exclusionReason})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-right tabular-nums">{p.seniorPrice} Kč</td>
                              <td className="py-2 text-right tabular-nums font-semibold text-primary">
                                {p.juniorPrice} Kč
                              </td>
                              <td className="py-2 text-xs text-gray-500">
                                {eventTypes.find((et) => et.id === p.seniorId)?.hidden
                                  ? 'combo'
                                  : 'top-level'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={handleGenerate}
                    disabled={status === 'generating' || selectedCount === 0 || !targetCategoryId}
                    className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {status === 'generating'
                      ? `Создаём… (${progress.done}/${progress.total})`
                      : `Создать (${selectedCount})`}
                  </button>
                  {existingMaps.length > 0 && (
                    <span className="text-xs text-gray-500">
                      Уже создано раньше: {existingMaps.length}
                    </span>
                  )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="text-sm font-semibold mb-3">
                      Результат: <span className="text-green-600">{okCount} OK</span>
                      {errCount > 0 && <span className="text-red-600 ml-3">{errCount} ошибок</span>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b">
                            <th className="py-2">Услуга</th>
                            <th className="py-2 text-right">Цена</th>
                            <th className="py-2">Junior ID</th>
                            <th className="py-2">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => (
                            <tr key={r.plan.key} className="border-b last:border-b-0">
                              <td className="py-2">{r.plan.seniorTitle}</td>
                              <td className="py-2 text-right tabular-nums">
                                {r.plan.juniorPrice} Kč
                              </td>
                              <td className="py-2 text-xs font-mono text-gray-600">
                                {r.juniorId ?? '—'}
                              </td>
                              <td className="py-2">
                                {r.status === 'ok' && (
                                  <span className="text-green-600 text-xs font-semibold">OK</span>
                                )}
                                {r.status === 'error' && (
                                  <span className="text-red-600 text-xs">{r.error}</span>
                                )}
                                {r.status === 'skipped' && (
                                  <span className="text-gray-400 text-xs">пропущено</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <p className="font-semibold mb-1">Как это работает:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Скрипт создаёт копию каждой выбранной услуги в Noona под целевой категорией с
                      ценой -{JUNIOR_DISCOUNT_PERCENT}%.
                    </li>
                    <li>
                      Если senior — combo (hidden=true), junior-копия тоже hidden. Top-level
                      услуги остаются видимыми.
                    </li>
                    <li>
                      После генерации в Noona вручную назначь junior-мастеру (Yana) право работать с
                      junior event_types через её Skills.
                    </li>
                    <li>
                      Маппинг senior → junior сохраняется в Strapi (service-junior-map). Клиентский
                      сайт читает его и автоматически подменяет event_type ID при выборе
                      junior-мастера.
                    </li>
                    <li>
                      Кнопка можно нажимать многократно — уже созданные пары не дублируются.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}
