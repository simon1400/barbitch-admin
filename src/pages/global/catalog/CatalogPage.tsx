// Редактор собственного каталога услуг (salon-service) — замена Noona-модулей
// управления после cutover. Owner-only (/global/catalog).
// ⚠️ Каталог живой: движок бронирования читает эти записи — правки сразу на сайте.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CatalogModifier,
  CatalogServiceFull,
  CatalogVariant,
  MasterOption,
  ServicePayload,
} from './fetch/bookingCatalog'
import {
  applyMasterAssignment,
  createService,
  fetchCatalogServices,
  fetchMasterOptions,
  updateService,
} from './fetch/bookingCatalog'

interface EditorState {
  documentId: string | null // null = создание новой услуги
  payload: ServicePayload
  masterIds: Set<string>
}

const EMPTY_PAYLOAD: ServicePayload = {
  title: '',
  category: '',
  categoryOrder: 0,
  order: 0,
  price: 0,
  durationMin: 60,
  description: '',
  active: true,
  onlineBookable: true,
  variants: [],
  modifiers: [],
}

const inputCls =
  'border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:border-primary'
const numCls = `${inputCls} w-24`
const btnCls = 'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors'

const CatalogPage = () => {
  const [services, setServices] = useState<CatalogServiceFull[]>([])
  const [masters, setMasters] = useState<MasterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [svc, ms] = await Promise.all([fetchCatalogServices(), fetchMasterOptions()])
      setServices(svc)
      setMasters(ms)
    } catch (e: unknown) {
      setError(`Не удалось загрузить каталог: ${e instanceof Error ? e.message : 'ошибка'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of services) {
      const c = s.category || 'Без категории'
      if (!seen.has(c)) {
        seen.add(c)
        out.push(c)
      }
    }
    return out
  }, [services])

  const mastersOfService = (s: CatalogServiceFull) =>
    masters.filter((m) => m.serviceDocIds.includes(s.documentId) || s.personalDocIds.includes(m.documentId))

  const openEditor = (s: CatalogServiceFull | null) => {
    setNotice('')
    if (!s) {
      setEditor({ documentId: null, payload: { ...EMPTY_PAYLOAD }, masterIds: new Set() })
      return
    }
    setEditor({
      documentId: s.documentId,
      payload: {
        title: s.title,
        category: s.category,
        categoryOrder: s.categoryOrder,
        order: s.order,
        price: s.price,
        durationMin: s.durationMin,
        description: s.description,
        active: s.active,
        onlineBookable: s.onlineBookable,
        variants: s.variants.map((v) => ({ ...v })),
        modifiers: s.modifiers.map((m) => ({ ...m })),
      },
      masterIds: new Set(mastersOfService(s).map((m) => m.documentId)),
    })
  }

  const patchPayload = (patch: Partial<ServicePayload>) =>
    setEditor((prev) => (prev ? { ...prev, payload: { ...prev.payload, ...patch } } : prev))

  const patchVariant = (idx: number, patch: Partial<CatalogVariant>) =>
    setEditor((prev) => {
      if (!prev) return prev
      const variants = prev.payload.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v))
      return { ...prev, payload: { ...prev.payload, variants } }
    })

  const patchModifier = (idx: number, patch: Partial<CatalogModifier>) =>
    setEditor((prev) => {
      if (!prev) return prev
      const modifiers = prev.payload.modifiers.map((m, i) => (i === idx ? { ...m, ...patch } : m))
      return { ...prev, payload: { ...prev.payload, modifiers } }
    })

  const removeAt = (kind: 'variants' | 'modifiers', idx: number) =>
    setEditor((prev) => {
      if (!prev) return prev
      const list = prev.payload[kind].filter((_, i) => i !== idx)
      return { ...prev, payload: { ...prev.payload, [kind]: list } }
    })

  const moveAt = (kind: 'variants' | 'modifiers', idx: number, dir: -1 | 1) =>
    setEditor((prev) => {
      if (!prev) return prev
      const list = [...prev.payload[kind]] as (CatalogVariant | CatalogModifier)[]
      const j = idx + dir
      if (j < 0 || j >= list.length) return prev
      ;[list[idx], list[j]] = [list[j], list[idx]]
      return { ...prev, payload: { ...prev.payload, [kind]: list } }
    })

  const toggleMaster = (docId: string) =>
    setEditor((prev) => {
      if (!prev) return prev
      const masterIds = new Set(prev.masterIds)
      if (masterIds.has(docId)) masterIds.delete(docId)
      else masterIds.add(docId)
      return { ...prev, masterIds }
    })

  const validate = (p: ServicePayload): string | null => {
    if (!p.title.trim()) return 'Название обязательно'
    if (!(p.durationMin > 0)) return 'Длительность должна быть > 0'
    if (p.price < 0) return 'Цена не может быть отрицательной'
    if (p.variants.some((v) => !v.label.trim())) return 'У варианта пустое название'
    if (p.modifiers.some((m) => !m.label.trim())) return 'У дополнения пустое название'
    const labels = p.variants.map((v) => v.label.trim())
    if (new Set(labels).size !== labels.length) return 'Названия вариантов должны быть уникальны'
    return null
  }

  const handleSave = async () => {
    if (!editor || saving) return
    const problem = validate(editor.payload)
    if (problem) {
      setNotice(`⚠ ${problem}`)
      return
    }
    setSaving(true)
    setNotice('')
    try {
      let docId = editor.documentId
      if (docId) {
        await updateService(docId, editor.payload)
      } else {
        docId = await createService(editor.payload)
      }
      const changed = docId ? await applyMasterAssignment(docId, editor.masterIds, masters) : 0
      setNotice(`✓ Сохранено${changed ? ` (мастера обновлены: ${changed})` : ''}`)
      setEditor(null)
      await load()
    } catch (e: unknown) {
      setNotice(`⚠ Ошибка сохранения: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  const renderEditor = (ed: EditorState) => (
    <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          {ed.documentId ? `Редактирование: ${ed.payload.title}` : 'Новая услуга'}
        </h3>
        <button className={`${btnCls} bg-gray-200 text-gray-700 hover:bg-gray-300`} onClick={() => setEditor(null)}>
          ← к списку
        </button>
      </div>

      {/* Скаляры */}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <label className="block text-xs text-gray-600">
          Название
          <input className={inputCls} value={ed.payload.title} onChange={(e) => patchPayload({ title: e.target.value })} />
        </label>
        <label className="block text-xs text-gray-600">
          Категория
          <input
            className={inputCls}
            list="catalog-categories"
            value={ed.payload.category}
            onChange={(e) => patchPayload({ category: e.target.value })}
          />
          <datalist id="catalog-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-3">
          <label className="block text-xs text-gray-600">
            Цена (Kč)
            <input type="number" className={numCls} value={ed.payload.price} onChange={(e) => patchPayload({ price: Number(e.target.value) })} />
          </label>
          <label className="block text-xs text-gray-600">
            Время (мин)
            <input type="number" className={numCls} value={ed.payload.durationMin} onChange={(e) => patchPayload({ durationMin: Number(e.target.value) })} />
          </label>
          <label className="block text-xs text-gray-600">
            Порядок
            <input type="number" className={numCls} value={ed.payload.order} onChange={(e) => patchPayload({ order: Number(e.target.value) })} />
          </label>
          <label className="block text-xs text-gray-600">
            Порядок категории
            <input type="number" className={numCls} value={ed.payload.categoryOrder} onChange={(e) => patchPayload({ categoryOrder: Number(e.target.value) })} />
          </label>
        </div>
        <div className="flex items-end gap-5 pb-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ed.payload.active} onChange={(e) => patchPayload({ active: e.target.checked })} />
            Активна
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ed.payload.onlineBookable} onChange={(e) => patchPayload({ onlineBookable: e.target.checked })} />
            Онлайн-запись
          </label>
        </div>
      </div>
      <label className="block text-xs text-gray-600 mb-5">
        Описание (info-бейдж на сайте)
        <textarea className={`${inputCls} h-16 resize-none`} value={ed.payload.description} onChange={(e) => patchPayload({ description: e.target.value })} />
      </label>

      {/* Варианты */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-800">Варианты (радио на шаге /extras)</h4>
          <button
            className={`${btnCls} bg-primary text-white hover:opacity-90`}
            onClick={() =>
              patchPayload({ variants: [...ed.payload.variants, { label: '', priceDiff: 0, durationDiff: 0, description: '' }] })
            }
          >
            + вариант
          </button>
        </div>
        {ed.payload.variants.length === 0 && <p className="text-xs text-gray-400">Только базовый вариант.</p>}
        {ed.payload.variants.map((v, idx) => (
          <div key={idx} className="border border-gray-200 rounded-md p-2 mb-2 flex flex-wrap items-center gap-2">
            <span className="flex flex-col gap-0.5">
              <button className="text-gray-400 hover:text-gray-700 text-xs leading-none" onClick={() => moveAt('variants', idx, -1)}>▲</button>
              <button className="text-gray-400 hover:text-gray-700 text-xs leading-none" onClick={() => moveAt('variants', idx, 1)}>▼</button>
            </span>
            <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Название варианта" value={v.label} onChange={(e) => patchVariant(idx, { label: e.target.value })} />
            <label className="text-xs text-gray-500">
              +Kč <input type="number" className={numCls} value={v.priceDiff} onChange={(e) => patchVariant(idx, { priceDiff: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-gray-500">
              +мин <input type="number" className={numCls} value={v.durationDiff} onChange={(e) => patchVariant(idx, { durationDiff: Number(e.target.value) })} />
            </label>
            <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Описание (info)" value={v.description} onChange={(e) => patchVariant(idx, { description: e.target.value })} />
            <button className={`${btnCls} bg-red-50 text-red-600 hover:bg-red-100`} onClick={() => removeAt('variants', idx)}>
              Удалить
            </button>
          </div>
        ))}
      </div>

      {/* Дополнения */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-800">
            Дополнения (чекбоксы; одинаковая «группа» = взаимоисключающие)
          </h4>
          <button
            className={`${btnCls} bg-primary text-white hover:opacity-90`}
            onClick={() =>
              patchPayload({ modifiers: [...ed.payload.modifiers, { key: '', label: '', priceDiff: 0, durationDiff: 0, group: '', description: '' }] })
            }
          >
            + дополнение
          </button>
        </div>
        {ed.payload.modifiers.length === 0 && <p className="text-xs text-gray-400">Без дополнений.</p>}
        {ed.payload.modifiers.map((m, idx) => (
          <div key={idx} className="border border-gray-200 rounded-md p-2 mb-2 flex flex-wrap items-center gap-2">
            <span className="flex flex-col gap-0.5">
              <button className="text-gray-400 hover:text-gray-700 text-xs leading-none" onClick={() => moveAt('modifiers', idx, -1)}>▲</button>
              <button className="text-gray-400 hover:text-gray-700 text-xs leading-none" onClick={() => moveAt('modifiers', idx, 1)}>▼</button>
            </span>
            <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Название дополнения" value={m.label} onChange={(e) => patchModifier(idx, { label: e.target.value })} />
            <label className="text-xs text-gray-500">
              +Kč <input type="number" className={numCls} value={m.priceDiff} onChange={(e) => patchModifier(idx, { priceDiff: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-gray-500">
              +мин <input type="number" className={numCls} value={m.durationDiff} onChange={(e) => patchModifier(idx, { durationDiff: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-gray-500">
              группа <input className={`${inputCls} w-28`} value={m.group} onChange={(e) => patchModifier(idx, { group: e.target.value })} />
            </label>
            <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Описание (info)" value={m.description} onChange={(e) => patchModifier(idx, { description: e.target.value })} />
            <button className={`${btnCls} bg-red-50 text-red-600 hover:bg-red-100`} onClick={() => removeAt('modifiers', idx)}>
              Удалить
            </button>
          </div>
        ))}
      </div>

      {/* Мастера */}
      <div className="mb-5">
        <h4 className="text-sm font-bold text-gray-800 mb-2">Мастера услуги</h4>
        <div className="flex flex-wrap gap-3">
          {masters.map((m) => (
            <label key={m.documentId} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-1.5">
              <input type="checkbox" checked={ed.masterIds.has(m.documentId)} onChange={() => toggleMaster(m.documentId)} />
              {m.name}
              {m.tier === 'junior' && (
                <span className="text-[10px] font-semibold text-primary bg-pink-50 border border-pink-200 rounded px-1">junior</span>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Junior-мастер автоматически даёт −20 % от итоговой цены (считает движок).
        </p>
      </div>

      {notice && <p className="text-sm mb-3">{notice}</p>}

      <button
        className={`${btnCls} bg-primary text-white hover:opacity-90 px-6 py-2 text-sm ${saving ? 'opacity-60' : ''}`}
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </div>
  )

  const renderList = () => (
    <>
      {categories.map((cat) => (
        <div key={cat} className="bg-white rounded-lg shadow mb-4 overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-gray-50 font-bold text-sm text-gray-800">{cat}</div>
          <table className="w-full text-left table-auto">
            <tbody>
              {services
                .filter((s) => (s.category || 'Без категории') === cat)
                .map((s) => {
                  const ms = mastersOfService(s)
                  return (
                    <tr key={s.documentId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm text-gray-800">
                        <span className="font-semibold">{s.title}</span>
                        {!s.active && (
                          <span className="ml-2 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1">выключена</span>
                        )}
                        {s.active && !s.onlineBookable && (
                          <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">без онлайн-записи</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-sm text-gray-600 whitespace-nowrap">{s.price} Kč</td>
                      <td className="px-2 py-2.5 text-sm text-gray-600 whitespace-nowrap">{s.durationMin} мин</td>
                      <td className="px-2 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {s.variants.length > 0 && `вар.: ${s.variants.length}`}
                        {s.variants.length > 0 && s.modifiers.length > 0 && ' · '}
                        {s.modifiers.length > 0 && `доп.: ${s.modifiers.length}`}
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-500">
                        {ms.length ? ms.map((m) => m.name.split(' ')[0]).join(', ') : <span className="text-red-500">нет мастеров</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button className={`${btnCls} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={() => openEditor(s)}>
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Каталог услуг (rezervace)</h2>
        <div className="flex gap-2">
          <button className={`${btnCls} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={load} disabled={loading}>
            Обновить
          </button>
          <button className={`${btnCls} bg-primary text-white hover:opacity-90`} onClick={() => openEditor(null)}>
            + Услуга
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Собственный каталог движка бронирования. Правки сразу видны на сайте (/book) — цены, варианты,
        дополнения и назначение мастеров считаются отсюда, Noona не участвует.
      </p>

      {notice && !editor && <p className="text-sm mb-3">{notice}</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <div className="text-gray-500">Загрузка…</div>
      ) : editor ? (
        renderEditor(editor)
      ) : (
        renderList()
      )}
    </div>
  )
}

export default CatalogPage
